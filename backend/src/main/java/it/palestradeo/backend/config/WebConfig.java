package it.palestradeo.backend.config;

import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class WebConfig {

    private final AppProperties props;

    public WebConfig(AppProperties props) {
        this.props = props;
    }

    /**
     * CORS gestito da un filtro servlet eseguito PRIMA del filtro di autenticazione:
     * così anche le risposte 401/503 portano gli header CORS e i preflight OPTIONS
     * ricevono risposta senza token.
     */
    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilter() {
        List<String> origins = Arrays.stream(props.allowedOrigins().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(origins.isEmpty() ? List.of("*") : origins);
        cfg.setAllowedMethods(List.of("GET", "PUT", "POST", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cfg);

        FilterRegistrationBean<CorsFilter> reg = new FilterRegistrationBean<>(new CorsFilter(source));
        reg.addUrlPatterns("/api/*");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return reg;
    }

    /** Filtro di autenticazione con bearer token. */
    @Bean
    public FilterRegistrationBean<TokenAuthFilter> tokenAuthFilter(ObjectMapper mapper) {
        FilterRegistrationBean<TokenAuthFilter> reg = new FilterRegistrationBean<>(new TokenAuthFilter(props, mapper));
        reg.addUrlPatterns("/api/*");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return reg;
    }

    /** Limite dimensione richiesta (dopo l'autenticazione: client non autenticati ricevono 401). */
    @Bean
    public FilterRegistrationBean<RequestSizeFilter> requestSizeFilter(ObjectMapper mapper) {
        FilterRegistrationBean<RequestSizeFilter> reg = new FilterRegistrationBean<>(new RequestSizeFilter(props, mapper));
        reg.addUrlPatterns("/api/*");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        return reg;
    }

    /**
     * Jackson limita per default le stringhe a 20M caratteri: il payload di un backup
     * (base64 di ~150MB) richiede un limite molto più alto.
     */
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer largeStringsCustomizer() {
        long maxBytes = (long) props.maxUploadMb() * 1024L * 1024L;
        int maxLen = (int) Math.min(Integer.MAX_VALUE - 8L, maxBytes);
        return builder -> builder.postConfigurer(mapper -> mapper.getFactory().setStreamReadConstraints(
                StreamReadConstraints.builder().maxStringLength(maxLen).build()));
    }
}
