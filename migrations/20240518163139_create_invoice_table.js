/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').unsigned().notNullable();
    table.foreign('customer_id').references('customers.id');
    table.decimal('amount', 10, 2).notNullable();
    table.date('invoice_date').notNullable();
    table.date('due_date').notNullable();
    table.enum('status', ['paid', 'pending', 'overdue']).defaultTo('pending');
    table.text('invoice_text');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTable('invoices');
};
