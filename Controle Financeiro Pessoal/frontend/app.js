const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
const currentDate = today.toISOString().slice(0, 10);

const emptyTransaction = () => ({
  id: null,
  description: "",
  type: "expense",
  category_id: "",
  amount: "",
  due_date: currentDate,
  payment_method: "Pix",
  notes: ""
});

const emptyBudget = () => ({
  id: null,
  category_id: "",
  month: currentMonth,
  limit_amount: ""
});

const emptyCategory = () => ({
  id: null,
  name: "",
  type: "expense",
  color: "#c58a28"
});

Vue.createApp({
  data() {
    return {
      view: "dashboard",
      categories: [],
      transactions: [],
      budgets: [],
      summary: {
        income: 0,
        expense: 0,
        balance: 0,
        by_category: [],
        budget_progress: []
      },
      filters: {
        month: currentMonth,
        type: "",
        q: ""
      },
      transactionForm: emptyTransaction(),
      budgetForm: emptyBudget(),
      categoryForm: emptyCategory(),
      message: {
        text: "",
        type: "success"
      }
    };
  },
  computed: {
    stats() {
      return {
        transactions: this.transactions.length,
        categories: this.categories.length,
        budgets: this.budgets.length
      };
    },
    topCategory() {
      const top = this.summary.by_category[0];
      return top ? top.category : "Sem dados";
    }
  },
  async mounted() {
    await this.loadAll();
  },
  methods: {
    async request(path, options = {}) {
      const response = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Erro inesperado na operação.");
      }
      return payload;
    },
    async loadAll() {
      try {
        const payload = await this.request(`/api/bootstrap?month=${this.filters.month}`);
        this.categories = payload.categories;
        this.transactions = payload.transactions;
        this.budgets = payload.budgets;
        this.summary = payload.summary;
        this.ensureDefaultCategories();
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    async loadTransactions() {
      try {
        const params = new URLSearchParams({
          month: this.filters.month,
          type: this.filters.type,
          q: this.filters.q
        });
        this.transactions = await this.request(`/api/transactions?${params}`);
        this.summary = await this.request(`/api/summary?month=${this.filters.month}`);
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    async loadBudgets() {
      this.budgets = await this.request(`/api/budgets?month=${this.filters.month}`);
      this.summary = await this.request(`/api/summary?month=${this.filters.month}`);
    },
    async loadCategories() {
      this.categories = await this.request("/api/categories");
    },
    categoriesByType(type) {
      return this.categories.filter((category) => category.type === type);
    },
    ensureDefaultCategories() {
      const choices = this.categoriesByType(this.transactionForm.type);
      if (!this.transactionForm.category_id && choices.length) {
        this.transactionForm.category_id = choices[0].id;
      }
      const expenseChoices = this.categoriesByType("expense");
      if (!this.budgetForm.category_id && expenseChoices.length) {
        this.budgetForm.category_id = expenseChoices[0].id;
      }
    },
    syncCategoryForType() {
      const choices = this.categoriesByType(this.transactionForm.type);
      this.transactionForm.category_id = choices.length ? choices[0].id : "";
    },
    async saveTransaction() {
      try {
        const method = this.transactionForm.id ? "PUT" : "POST";
        const url = this.transactionForm.id
          ? `/api/transactions/${this.transactionForm.id}`
          : "/api/transactions";
        await this.request(url, {
          method,
          body: JSON.stringify(this.transactionForm)
        });
        this.notify(this.transactionForm.id ? "Transação atualizada." : "Transação criada.");
        this.resetTransaction();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    editTransaction(transaction) {
      this.view = "transactions";
      this.transactionForm = {
        id: transaction.id,
        description: transaction.description,
        type: transaction.type,
        category_id: transaction.category_id,
        amount: transaction.amount,
        due_date: transaction.due_date,
        payment_method: transaction.payment_method || "Pix",
        notes: transaction.notes || ""
      };
    },
    resetTransaction() {
      this.transactionForm = emptyTransaction();
      this.ensureDefaultCategories();
    },
    async deleteTransaction(id) {
      if (!confirm("Excluir esta transação?")) return;
      try {
        await this.request(`/api/transactions/${id}`, { method: "DELETE" });
        this.notify("Transação excluída.");
        await this.loadAll();
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    async saveBudget() {
      try {
        const method = this.budgetForm.id ? "PUT" : "POST";
        const url = this.budgetForm.id ? `/api/budgets/${this.budgetForm.id}` : "/api/budgets";
        await this.request(url, {
          method,
          body: JSON.stringify(this.budgetForm)
        });
        this.notify(this.budgetForm.id ? "Orçamento atualizado." : "Orçamento criado.");
        this.budgetForm = emptyBudget();
        this.ensureDefaultCategories();
        await this.loadBudgets();
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    editBudget(budget) {
      this.budgetForm = {
        id: budget.id,
        category_id: budget.category_id,
        month: budget.month,
        limit_amount: budget.limit_amount
      };
    },
    async deleteBudget(id) {
      if (!confirm("Excluir este orçamento?")) return;
      try {
        await this.request(`/api/budgets/${id}`, { method: "DELETE" });
        this.notify("Orçamento excluído.");
        await this.loadBudgets();
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    async saveCategory() {
      try {
        const method = this.categoryForm.id ? "PUT" : "POST";
        const url = this.categoryForm.id
          ? `/api/categories/${this.categoryForm.id}`
          : "/api/categories";
        await this.request(url, {
          method,
          body: JSON.stringify(this.categoryForm)
        });
        this.notify(this.categoryForm.id ? "Categoria atualizada." : "Categoria criada.");
        this.categoryForm = emptyCategory();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    editCategory(category) {
      this.categoryForm = {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color
      };
    },
    async deleteCategory(id) {
      if (!confirm("Excluir esta categoria? Categorias em uso não podem ser removidas.")) return;
      try {
        await this.request(`/api/categories/${id}`, { method: "DELETE" });
        this.notify("Categoria excluída.");
        await this.loadAll();
      } catch (error) {
        this.notify(error.message, "error");
      }
    },
    categoryWidth(total) {
      const max = Math.max(...this.summary.by_category.map((item) => item.total), 1);
      return `${Math.max((total / max) * 100, 4)}%`;
    },
    money(value) {
      return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    },
    formatDate(value) {
      if (!value) return "";
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    },
    notify(text, type = "success") {
      this.message = { text, type };
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.message.text = "";
      }, 3200);
    }
  }
}).mount("#app");
