package it.palestradeo.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.token=")
@AutoConfigureMockMvc
class MissingTokenTest {

    @Autowired
    MockMvc mvc;

    @Test
    void protectedEndpointsReturn503WhenTokenNotConfigured() throws Exception {
        mvc.perform(get("/api/backup").header(HttpHeaders.AUTHORIZATION, "Bearer qualcosa"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("APP_TOKEN non configurato sul server"));
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenConfigured").value(false));
    }
}
