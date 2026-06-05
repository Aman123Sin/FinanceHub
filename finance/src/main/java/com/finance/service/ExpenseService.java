package com.finance.service;

import com.finance.entity.Expense;
import com.finance.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;

    public ExpenseService(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
    }

    // FIX: always scope to userId
    public List<Expense> getAllExpenses(Long userId) {
        return expenseRepository.findByUserId(userId);
    }

    public Expense saveExpense(Expense expense) {
        // Validate required fields — this prevents null data being saved
        if (expense.getTitle() == null || expense.getTitle().isBlank()) {
            throw new RuntimeException("Title is required");
        }
        if (expense.getAmount() == null || expense.getAmount() <= 0) {
            throw new RuntimeException("Amount must be positive");
        }
        if (expense.getUserId() == null) {
            throw new RuntimeException("userId is required");
        }
        return expenseRepository.save(expense);
    }

    public Expense updateExpense(Long id, Long userId, Expense updatedExpense) {
        Expense existing = expenseRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Expense not found"));

        existing.setTitle(updatedExpense.getTitle());
        existing.setAmount(updatedExpense.getAmount());
        existing.setCategory(updatedExpense.getCategory());
        existing.setDescription(updatedExpense.getDescription());
        existing.setDate(updatedExpense.getDate());
        return saveExpense(existing);
    }

    @Transactional
    public void deleteExpense(Long id, Long userId) {
        expenseRepository.deleteByIdAndUserId(id, userId);
    }
}
