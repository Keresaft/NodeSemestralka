import express from 'express'
import knex from 'knex'
import knexfile from './knexfile.js'
import axios from 'axios'; // Import Axios for making HTTP requests
import PDFDocument from 'pdfkit'; // Import PDFKit for PDF generation
import fs from 'fs'; // Import Node.js file system module for working with files


const app = express()
const db = knex(knexfile)

app.set('view engine', 'ejs')

app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  console.log('Incomming request', req.method, req.url)
  next()
})


//Open new customer page
app.get('/new-customer', (req, res) => {
  res.render('new-customer', { title: 'Create New Customer' });
});

//Add new customer
app.post('/add-customer', async (req, res) => {
    const customer = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      ico: req.body.ico,
      dico: req.body.dico
    };

    await db('customers').insert(customer);

    res.redirect('/');
});


//Open new user page
app.get('/set-user', async (req, res) => {
  const user = await db('users').first();
  res.render('set-user', { title: 'Set User Details', user });
});

//Add new user details
app.post('/add-user', async (req, res) => {
  const user = {
    name: req.body.name,
    address: req.body.address,
    ico: req.body.ico,
    dico: req.body.dico,
    phone: req.body.phone,
    email: req.body.email,
  };

  await db('users').insert(user);

  res.redirect('/set-user'); 
});

//Update user info only 
app.post('/update-user', async (req, res) => {
  const userId = req.body.id;
  const updatedUser = {
    name: req.body.name,
    address: req.body.address,
    ico: req.body.ico,
    dico: req.body.dico,
    phone: req.body.phone,
    email: req.body.email,
  };

  await db('users').where('id', userId).update(updatedUser);

  res.redirect('/set-user'); 
});


//Render all the invoices with the customer info 
app.get('/', async (req, res) => {
    const invoices = await db('invoices')
      .select('invoices.*', 'customers.name as customer_name')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id');

      const totalAmount = await db('invoices').sum('amount as total').first();

    res.render('index', {
    title: 'Invoices',
    invoices,
    totalAmount: totalAmount.total
  });
});

//Render a customer list
app.get('/all-customer', async (req, res) => {
    const customers = await db('customers').select('*');
    
    res.render('all-customer', {
      title: 'All Customers',
      customers,
    });
});


//Render a detail of one invoice
app.get('/invoice/:id', async (req, res, next) => {
  const invoice = await db('invoices')
    .select('invoices.*', 'customers.ico as customer_ico', 'customers.name as customer_name', 'customers.email as customer_email', 'customers.phone as customer_phone', 'customers.address as customer_address')
    .leftJoin('customers', 'invoices.customer_id', 'customers.id')
    .where('invoices.id', req.params.id)
    .first();

  if (!invoice) return next(); 

  res.render('invoice', { title: 'Invoice Details', invoice }); 
});


//Update one invoice 
app.post('/update-invoice/:id', async (req, res) => {
  const { amount, invoice_date, due_date, status, invoice_text } = req.body;
  const id = req.params.id;

  await db('invoices')
    .where('id', id)
    .update({
      amount,
      invoice_date,
      due_date,
      status,
      invoice_text
    });

  res.redirect('/');
});

//Update customer info page open
app.get('/edit-customer/:id', async (req, res) => {
    const customerId = req.params.id;
    const customer = await db('customers').where('id', customerId).first();
    res.render('edit-customer', { title: 'Edit Customer', customer });
});

//Update customer info
app.post('/update-customer/:id', async (req, res) => {
    const customerId = req.params.id;
    const { name, email, phone, address, ico, dico } = req.body;
    await db('customers').where('id', customerId).update({
      name,
      email,
      phone,
      address,
      ico,
      dico
    });

    res.redirect('/all-customer');
});



//Přidej invoice - otevření nové stránky 
app.get('/new-invoice', async (req, res) => {
  const customers = await db.select('*').from('customers');
  res.render('new-invoice', { title: 'Create New Invoice', customers });
});


//přidání nové faktury do databáze 
app.post('/add-invoice', async (req, res) => {
  const invoice = {
    customer_id: req.body.customer_id, // Assuming customer_id is passed from the form
    amount: req.body.amount,
    invoice_date: req.body.invoice_date,
    due_date: req.body.due_date,
    status: req.body.status,
    invoice_text: req.body.invoice_text,
  };

  await db('invoices').insert(invoice);

  res.redirect('/');
});




//Vyhledat zákazníka podle ICO přes Ares api
app.post('/search-customer', async (req, res) => {
  const { icoSearch } = req.body;
  try {
    const response = await axios.get(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${icoSearch}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    const data = {
      title: 'Create New Customer',
      name: response.data.obchodniJmeno,
      address: `${response.data.adresaDorucovaci.radekAdresy1}, ${response.data.adresaDorucovaci.radekAdresy2}, ${response.data.adresaDorucovaci.radekAdresy3}`,
      ico: `${response.data.ico}`, // Assuming DICO is CZ + ICO
    };
    res.render('new-customer-search', {title: 'Create New Invoice', data });
  } catch (error) {
    console.error('Error searching for customer:', error);
    res.status(500).send('Failed to fetch customer data from ARES API');
  }
});





//Delete one invoice
app.get('/delete-invoice/:id', async (req, res) => {
  const invoice = await db('invoices').select('*').where('id', req.params.id).first()

  if (!invoice) return next()

  await db('invoices').delete().where('id', invoice.id)

  res.redirect('/')
})

//Delete customer with all existing invoices
app.get('/delete-customer/:id', async (req, res) => {
  try {
    const customerId = req.params.id;

    // Delete invoices associated with the customer
    await db('invoices').where('customer_id', customerId).del();

    // Delete the customer
    const deletedCustomerCount = await db('customers').where('id', customerId).del();

    if (deletedCustomerCount === 0) {
      // If the customer with the provided ID doesn't exist, handle accordingly
      return res.status(404).send('Customer not found');
    }

    // Redirect back to the customer list page
    res.redirect('/all-customer');
  } catch (error) {
    // If an error occurs during the deletion process, handle accordingly
    console.error('Error deleting customer and associated invoices:', error);
    res.status(500).send('Failed to delete customer and associated invoices');
  }
});

app.get('/download-invoice/:id', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await db('invoices').where('id', invoiceId).first();

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const customer = await db('customers').where('id', invoice.customer_id).first();

    if (!customer) {
      return res.status(404).send('Customer not found');
    }

    // Retrieve user information
    const user = await db('users').first();

    if (!user) {
      return res.status(404).send('User not found');
    }

    const doc = new PDFDocument();

    // Set response headers for downloading the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceId}.pdf`);

    // Stream the PDF document directly to the response
    doc.pipe(res);

    // Add user info section without borders
    doc.fontSize(18).text('User Details', { align: 'center', bold: true }).moveDown(0.5);
    doc.rect(50, 100, 500, 80); // Rectangle for user info without borders
    doc.fontSize(12).text(`Name: ${user.name}`, 60, 110, { bold: true });
    doc.text(`Address: ${user.address}`, 60, 130);
    doc.text(`Phone: ${user.phone}`, 60, 150);
    doc.text(`Email: ${user.email}`, 60, 170);
    doc.text(`ICO: ${user.ico}`, 60, 190, { bold: true });
    doc.text(`DICO: ${user.dico}`, 60, 210);

    // Add customer info section without borders
    doc.fontSize(18).text('Customer Details', { align: 'center', bold: true }).moveDown(1);
    doc.rect(50, 260, 500, 120); // Rectangle for customer info without borders
    doc.fontSize(12).text(`Name: ${customer.name}`, 60, 270, { bold: true });
    doc.text(`Address: ${customer.address}`, 60, 290);
    doc.text(`Phone: ${customer.phone}`, 60, 310);
    doc.text(`Email: ${customer.email}`, 60, 330);
    doc.text(`ICO: ${customer.ico}`, 60, 350, { bold: true });
    doc.text(`DICO: ${customer.dico}`, 60, 370);

    // Add invoice details section
    doc.fontSize(18).text('Invoice Details', { align: 'center', bold: true }).moveDown(0.5);
    doc.fontSize(12).text(`Invoice ID: ${invoice.id}`).moveDown(0.5);
    doc.text(`Invoice Date: ${invoice.invoice_date}`).moveDown(0.5);
    doc.text(`Due Date: ${invoice.due_date}`, { bold: true }).moveDown(0.5);
    doc.text(`Status: ${invoice.status}`).moveDown(0.5);
    doc.text(`Amount: ${invoice.amount}`, { bold: true }).moveDown(0.5);

    // Finalize the PDF document
    doc.end();
  } catch (error) {
    // If an error occurs, handle accordingly
    console.error('Error generating PDF invoice:', error);
    res.status(500).send('Failed to generate PDF invoice');
  }
});


//erros
app.use((req, res) => {
  res.status(404)
  res.send('404 - Stránka nenalezena')
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500)
  res.send('500 - Chyba na straně serveru')
})

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000')
})