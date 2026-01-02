package com.yggdrasil.svartalfheim;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Svartalfheim Realm Application
 * 
 * OWASP A08:2025 - Software/Data Integrity
 * 
 * This application demonstrates insecure deserialization vulnerabilities
 * where untrusted data is deserialized without proper validation or
 * integrity checks.
 */
@SpringBootApplication
public class SvartalfheimApplication {

    public static void main(String[] args) {
        SpringApplication.run(SvartalfheimApplication.class, args);
        System.out.println("Svartalfheim Realm started successfully");
    }
}
