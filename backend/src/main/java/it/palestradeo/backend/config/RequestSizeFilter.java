package it.palestradeo.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Rifiuta con 413 le richieste con Content-Length oltre MAX_UPLOAD_MB.
 * (Per richieste chunked senza Content-Length interviene il limite di Jackson
 * sulla lunghezza delle stringhe, mappato anch'esso a 413.)
 */
public class RequestSizeFilter extends OncePerRequestFilter {

    private final long maxBytes;
    private final ObjectMapper mapper;
    private final int maxUploadMb;

    public RequestSizeFilter(AppProperties props, ObjectMapper mapper) {
        this.maxUploadMb = props.maxUploadMb();
        this.maxBytes = (long) props.maxUploadMb() * 1024L * 1024L + 64L * 1024L; // margine per i metadati JSON
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long len = request.getContentLengthLong();
        if (len > maxBytes) {
            response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setHeader("Connection", "close");
            mapper.writeValue(response.getOutputStream(),
                    Map.of("error", "Richiesta troppo grande (limite " + maxUploadMb + " MB)"));
            return;
        }
        chain.doFilter(request, response);
    }
}
