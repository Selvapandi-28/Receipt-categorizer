# Smart Receipt Scanner and Expense Tracker

A full-stack web application designed for automated receipt scanning, expense categorization, and budget management. Powered by Google Gemini AI, the system processes receipt images, extracts structured line-item data, categorizes expenses, and synchronizes transactions with local and cloud storage.

---

## Short Description for GitHub About Section

An AI-powered receipt scanner and expense manager that extracts structured purchase data from images, categorizes expenses, and supports offline-first synchronization.

---

## Key Features

- **Automated Receipt Parsing**: Processes uploaded receipt images using multimodal AI to extract merchant names, dates, line items, tax, and total amounts.
- **Offline-First Synchronization**: Queues local transaction edits when offline and automatically syncs changes with the cloud database when connectivity is restored.
- **Visual Cloud Sync Status**: Real-time header indicator displaying database connection status and pending local cache uploads.
- **Advanced Search and Filtering**: Query receipts by merchant, transaction date, category tags, price range, line items, or receipt format (scanned vs. manual).
- **Multi-Currency Conversion**: Dynamic conversion across major currencies with live exchange rate calculation.
- **Budget Tracking and Analytics**: Interactive dashboard showing category spending breakdowns, budget threshold alerts, and monthly summaries.
- **Theme Personalization**: Options for modern dark, clean light, and custom visual themes with responsive layouts across desktop and mobile devices.

---

## Getting Started Locally

### Prerequisites
- Node.js (v18 or higher)
- npm (Node Package Manager)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/receipt-expense-tracker.git
cd receipt-expense-tracker
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory by copying the example environment file:
```bash
cp .env.example .env
```

Add your Gemini API Key in the `.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Development Server
Start the development server:
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

---

## Production Build

To compile the application for production deployment:

1. **Build the assets**:
   ```bash
   npm run build
   ```
   This command compiles the React frontend into static assets in `dist/` and bundles the Express backend server into `dist/server.cjs`.

2. **Start the production server**:
   ```bash
   npm start
   ```

---

## Project Architecture

- `/src/components/ReceiptScanner.jsx`: Client-side receipt upload, image compression, and OCR processing integration.
- `/src/components/ExpenseList.jsx`: Transaction list view with advanced multi-criteria filtering, sorting, and inline deletion.
- `/src/App.jsx`: Main workspace state manager, routing, theme controller, and offline sync handler.
- `/server.ts`: Express backend handling API routes for receipt analysis, expense endpoints, and database interactions.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

