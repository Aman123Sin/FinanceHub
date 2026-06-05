package com.finance;

import com.finance.service.UserService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class FinanceApplication {

	public static void main(String[] args) {
		SpringApplication.run(FinanceApplication.class, args);
	}

	@Bean
	CommandLineRunner seedAdmin(UserService userService) {
		return args -> userService.ensureDefaultAdmin();
	}

}
