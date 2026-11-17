package it.palestradeo.backend.web;

import it.palestradeo.backend.PalestraBackendApplication;
import it.palestradeo.backend.config.AppProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

    private final AppProperties props;

    public HealthController(AppProperties props) {
        this.props = props;
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("aiEnabled", props.ai().enabled());
        body.put("tokenConfigured", props.tokenConfigured());
        body.put("version", PalestraBackendApplication.VERSION);
        return body;
    }
}
