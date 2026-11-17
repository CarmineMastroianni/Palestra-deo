package it.palestradeo.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.hasKey;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Configurazione di test: src/test/resources/application.yml (H2 in memoria, token "test-token", max 3 versioni). */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

    private static final String AUTH = "Bearer test-token";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @BeforeEach
    void cleanup() throws Exception {
        mvc.perform(delete("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH)).andExpect(status().isOk());
    }

    @Test
    void healthWithoutToken() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.aiEnabled").value(false))
                .andExpect(jsonPath("$.tokenConfigured").value(true))
                .andExpect(jsonPath("$.version").value("1.0.0"));
    }

    @Test
    void protectedEndpointsRequireToken() throws Exception {
        mvc.perform(get("/api/backup"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").exists());
        mvc.perform(get("/api/backup").header(HttpHeaders.AUTHORIZATION, "Bearer sbagliato"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Token di accesso non valido"));
        mvc.perform(post("/api/ai/chat").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void corsPreflightPassesWithoutToken() throws Exception {
        mvc.perform(options("/api/backup")
                        .header(HttpHeaders.ORIGIN, "https://example.vercel.app")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://example.vercel.app"));
    }

    @Test
    void backupLifecycle() throws Exception {
        mvc.perform(get("/api/backup/latest").header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Nessun backup presente"));

        long firstId = putBackup("cGF5bG9hZC0x", "2026-11-17T10:00:00.000Z");
        long secondId = putBackup("cGF5bG9hZC0y", "2026-11-17T11:00:00.000Z");
        assertThat(secondId).isGreaterThan(firstId);

        mvc.perform(get("/api/backup/latest").header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(secondId))
                .andExpect(jsonPath("$.payload").value("cGF5bG9hZC0y"))
                .andExpect(jsonPath("$.deviceId").value("device-test"))
                .andExpect(jsonPath("$.checksum").value("abc123"));

        mvc.perform(get("/api/backup/" + firstId).header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload").value("cGF5bG9hZC0x"));

        mvc.perform(get("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(secondId))
                .andExpect(jsonPath("$[0].size").value(12))
                .andExpect(jsonPath("$[0]", not(hasKey("payload"))));

        // max-versions = 3 nei test: dopo 5 backup ne restano 3, i più recenti
        putBackup("cGF5bG9hZC0z", "2026-11-17T12:00:00.000Z");
        putBackup("cGF5bG9hZC00", "2026-11-17T13:00:00.000Z");
        long lastId = putBackup("cGF5bG9hZC01", "2026-11-17T14:00:00.000Z");

        mvc.perform(get("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].id").value(lastId));
        mvc.perform(get("/api/backup/" + firstId).header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());

        mvc.perform(delete("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(3));
        mvc.perform(get("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void backupRejectsEmptyPayload() throws Exception {
        mvc.perform(put("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"d\",\"createdAt\":\"2026-11-17T10:00:00Z\",\"payload\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Il payload del backup è vuoto"));
        mvc.perform(put("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("non json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void aiReturns503WithoutApiKey() throws Exception {
        String body = mapper.writeValueAsString(Map.of(
                "system", "Sei un personal trainer.",
                "messages", java.util.List.of(Map.of("role", "user", "content", "Ciao"))));
        mvc.perform(post("/api/ai/chat").header(HttpHeaders.AUTHORIZATION, AUTH)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("Assistente AI non configurato sul server"));
    }

    @Test
    void aiValidatesMessages() throws Exception {
        mvc.perform(post("/api/ai/chat").header(HttpHeaders.AUTHORIZATION, AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"system\":\"x\",\"messages\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
        mvc.perform(post("/api/ai/chat").header(HttpHeaders.AUTHORIZATION, AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[{\"role\":\"system\",\"content\":\"x\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Il ruolo dei messaggi deve essere 'user' o 'assistant'"));
    }

    private long putBackup(String payload, String createdAt) throws Exception {
        String body = mapper.writeValueAsString(Map.of(
                "deviceId", "device-test", "createdAt", createdAt, "payload", payload, "checksum", "abc123"));
        MvcResult res = mvc.perform(put("/api/backup").header(HttpHeaders.AUTHORIZATION, AUTH)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdAt").value(createdAt))
                .andExpect(jsonPath("$.receivedAt").exists())
                .andExpect(jsonPath("$.size").value(payload.length()))
                .andReturn();
        JsonNode node = mapper.readTree(res.getResponse().getContentAsString());
        return node.get("id").asLong();
    }
}
