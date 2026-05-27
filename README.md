# NeighborGoods - Local Borrowing Network Backend

This is the Node.js / Express / MongoDB backend server for **NeighborGoods** - a hyper-local, peer-to-peer inventory sharing platform for high-trust communities.

## Tech Stack
- Node.js
- Express
- MongoDB (Mongoose)
- Socket.io
- Cloudinary (for image uploads)

## Setup and Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`. Use `.env.example` as a template:
   ```bash
   cp .env.example .env
   ```

3. Seed the admin account:
   ```bash
   npm run seed
   ```

4. Start development server:
   ```bash
   npm run dev
   ```
