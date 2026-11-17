package it.palestradeo.backend.web;

import org.springframework.http.HttpStatus;

/** Eccezione applicativa con stato HTTP e messaggio (in italiano) da restituire al client. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
