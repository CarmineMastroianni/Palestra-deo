package it.palestradeo.backend.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlock;
import it.palestradeo.backend.config.AppProperties;
import it.palestradeo.backend.web.ApiException;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.stream.Collectors;

/**
 * Proxy verso l'API di Claude tramite l'SDK ufficiale Anthropic per Java.
 * La chiave API resta sul server; il client viene creato pigramente e solo se la chiave è presente.
 */
@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    static final String REFUSAL_TEXT =
            "Mi dispiace, non posso rispondere a questa richiesta. Prova a riformularla.";

    private final AppProperties.Ai cfg;
    private volatile AnthropicClient client;

    public AiService(AppProperties props) {
        this.cfg = props.ai();
    }

    public boolean enabled() {
        return cfg.enabled();
    }

    private AnthropicClient client() {
        AnthropicClient c = client;
        if (c == null) {
            synchronized (this) {
                c = client;
                if (c == null) {
                    c = AnthropicOkHttpClient.builder()
                            .apiKey(cfg.apiKey())
                            .timeout(Duration.ofMinutes(5))
                            .build();
                    client = c;
                }
            }
        }
        return c;
    }

    public AiDtos.ChatResponse chat(AiDtos.ChatRequest req) {
        if (!enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Assistente AI non configurato sul server");
        }

        long totalChars = (req.system() == null ? 0 : req.system().length())
                + req.messages().stream().mapToLong(m -> m.content().length()).sum();
        if (totalChars > cfg.maxInputChars()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Testo troppo lungo: massimo " + cfg.maxInputChars() + " caratteri in totale");
        }
        if (!"user".equals(req.messages().get(0).role())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Il primo messaggio deve avere ruolo 'user'");
        }
        if (!"user".equals(req.messages().get(req.messages().size() - 1).role())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "L'ultimo messaggio deve avere ruolo 'user'");
        }

        String model = (req.model() == null || req.model().isBlank()) ? cfg.model() : req.model().trim();

        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(cfg.maxTokens())
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build());
        if (req.system() != null && !req.system().isBlank()) {
            params.system(req.system());
        }
        for (AiDtos.ChatMessage m : req.messages()) {
            if ("assistant".equals(m.role())) {
                params.addAssistantMessage(m.content());
            } else {
                params.addUserMessage(m.content());
            }
        }

        Message response;
        try {
            response = client().messages().create(params.build());
        } catch (RateLimitException e) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Troppe richieste all'assistente AI, riprova tra qualche istante");
        } catch (UnauthorizedException | PermissionDeniedException e) {
            log.error("Chiave API Anthropic rifiutata (status {})", e.statusCode());
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Chiave API dell'assistente AI non valida o senza permessi: controlla la configurazione del server");
        } catch (AnthropicServiceException e) {
            log.warn("Errore dall'API Anthropic: status={} type={}", e.statusCode(), e.errorType().orElse(null));
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Errore del servizio AI (" + e.statusCode() + "), riprova più tardi");
        } catch (AnthropicIoException e) {
            log.warn("Errore di rete verso l'API Anthropic: {}", e.getClass().getSimpleName());
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT,
                    "Il servizio AI non risponde, riprova più tardi");
        }

        String stopReason = response.stopReason().map(StopReason::asString).orElse("unknown");
        String text;
        if ("refusal".equals(stopReason)) {
            text = REFUSAL_TEXT;
        } else {
            text = response.content().stream()
                    .flatMap(b -> b.text().stream())
                    .map(TextBlock::text)
                    .collect(Collectors.joining("\n"))
                    .strip();
        }
        return new AiDtos.ChatResponse(text, stopReason, response.model().asString());
    }

    @PreDestroy
    void close() {
        AnthropicClient c = client;
        if (c != null) {
            c.close();
        }
    }
}
