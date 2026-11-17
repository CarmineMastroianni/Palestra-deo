package it.palestradeo.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Protegge /api/** con "Authorization: Bearer &lt;APP_TOKEN&gt;".
 * Eccezioni: GET /api/health e le richieste preflight CORS (OPTIONS).
 */
public class TokenAuthFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final AppProperties props;
    private final ObjectMapper mapper;

    public TokenAuthFilter(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (!path.startsWith("/api/")) {
            return true;
        }
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        return HttpMethod.GET.matches(request.getMethod()) && path.equals("/api/health");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!props.tokenConfigured()) {
            writeError(response, HttpStatus.SERVICE_UNAVAILABLE, "APP_TOKEN non configurato sul server");
            return;
        }
        String header = request.getHeader("Authorization");
        if (header == null || !header.regionMatches(true, 0, BEARER, 0, BEARER.length())) {
            writeError(response, HttpStatus.UNAUTHORIZED, "Token di accesso mancante");
            return;
        }
        String provided = header.substring(BEARER.length()).trim();
        if (!constantTimeEquals(provided, props.token())) {
            writeError(response, HttpStatus.UNAUTHORIZED, "Token di accesso non valido");
            return;
        }
        chain.doFilter(request, response);
    }

    /** Confronto a tempo costante (anche rispetto alla lunghezza: si confrontano gli hash SHA-256). */
    static boolean constantTimeEquals(String a, String b) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] ha = md.digest(a.getBytes(StandardCharsets.UTF_8));
            byte[] hb = md.digest(b.getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(ha, hb);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        if (status == HttpStatus.UNAUTHORIZED) {
            response.setHeader("WWW-Authenticate", "Bearer");
        }
        mapper.writeValue(response.getOutputStream(), Map.of("error", message));
    }
}
