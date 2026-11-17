package it.palestradeo.backend.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class AiDtos {
    private AiDtos() {}

    public record ChatMessage(
            @NotNull(message = "Ruolo del messaggio mancante")
            @Pattern(regexp = "user|assistant", message = "Il ruolo dei messaggi deve essere 'user' o 'assistant'")
            String role,
            @NotBlank(message = "Il contenuto dei messaggi non può essere vuoto")
            String content) {}

    public record ChatRequest(
            String system,
            @NotEmpty(message = "La conversazione deve contenere almeno un messaggio")
            @Size(max = 500, message = "Troppi messaggi nella conversazione")
            List<@Valid @NotNull(message = "Messaggio non valido") ChatMessage> messages,
            @Size(max = 100, message = "Nome del modello non valido")
            String model) {}

    public record ChatResponse(String text, String stopReason, String model) {}
}
