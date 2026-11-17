package it.palestradeo.backend.backup;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/backup")
public class BackupController {

    private final BackupService service;

    public BackupController(BackupService service) {
        this.service = service;
    }

    @PutMapping
    public BackupDtos.BackupSaved save(@Valid @RequestBody BackupDtos.BackupRequest req) {
        return service.save(req);
    }

    @GetMapping
    public List<BackupDtos.BackupMeta> list() {
        return service.list();
    }

    @GetMapping("/latest")
    public BackupDtos.BackupFull latest() {
        return service.latest();
    }

    @GetMapping("/{id}")
    public BackupDtos.BackupFull get(@PathVariable long id) {
        return service.get(id);
    }

    @DeleteMapping
    public Map<String, Integer> deleteAll() {
        return Map.of("deleted", service.deleteAll());
    }
}
