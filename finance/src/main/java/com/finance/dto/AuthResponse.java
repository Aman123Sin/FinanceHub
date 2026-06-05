package com.finance.dto;

public class AuthResponse {
    private String token;
    private Long userId;
    private String name;
    private String email;
    private String phone;
    private String currency;
    private String role;
    private String createdAt;
    private Boolean premium;
    private Boolean active;

    public AuthResponse() {}

    public AuthResponse(String token, Long userId, String name, String email,
                        String phone, String currency, String role, String createdAt) {
        this.token = token;
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.currency = currency;
        this.role = role;
        this.createdAt = createdAt;
        this.premium = false;
        this.active = true;
    }

    public AuthResponse(String token, Long userId, String name, String email,
                        String phone, String currency, String role, String createdAt,
                        Boolean premium) {
        this(token, userId, name, email, phone, currency, role, createdAt);
        this.premium = premium;
    }

    public AuthResponse(String token, Long userId, String name, String email,
                        String phone, String currency, String role, String createdAt,
                        Boolean premium, Boolean active) {
        this(token, userId, name, email, phone, currency, role, createdAt, premium);
        this.active = active;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public Boolean getPremium() { return premium; }
    public void setPremium(Boolean premium) { this.premium = premium; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
