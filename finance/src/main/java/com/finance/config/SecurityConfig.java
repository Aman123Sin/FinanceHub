package com.finance.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

// BUG FIXED #3: Spring Security has its OWN CORS filter that runs BEFORE
// your CorsConfig. Without .cors(cors -> cors.and()), Spring Security would
// block preflight OPTIONS requests before your CORS config even ran.

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                .cors(cors -> cors.and())     // FIX: tell Spring Security to use your CorsConfig
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}