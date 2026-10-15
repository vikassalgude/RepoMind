# RepoMind (Developer Suite)
### AST-Aware Retrieval-Augmented Generation (RAG) Platform for GitHub Repositories

[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Cloud_Vector_DB-DC2626?style=for-the-badge&logo=qdrant&logoColor=white)](https://qdrant.tech/)
[![Redis](https://img.shields.io/badge/Upstash-Redis_BullMQ-FF4438?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F05A28?style=for-the-badge&logoColor=white)](https://groq.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Frontend_Deployment-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Render](https://img.shields.io/badge/Render-Backend_Deployment-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/)

---

### 🌐 Live Production Deployments
- **Web Application (Vercel)**: [https://repoo-mind.vercel.app](https://repoo-mind.vercel.app)
- **API Server & Ingestion Engine (Render)**: [https://repomind-server.onrender.com](https://repomind-server.onrender.com)
- **Uptime & Health Monitor**: [https://repomind-server.onrender.com/api/health](https://repomind-server.onrender.com/api/health)

---

## 📌 Executive Overview

**RepoMind** is a production-grade, AST-aware Codebase Intelligence Platform designed to index, understand, and converse with entire GitHub repositories. Unlike conventional developer tools that slice source code into arbitrary, overlapping chunks of raw text, RepoMind parses source code into an **Abstract Syntax Tree (AST)** using WebAssembly-powered Tree-Sitter grammars. 

By capturing logical language constructs—functions, method bodies, class hierarchies, interfaces, and module exports—RepoMind ensures vector embeddings preserve syntax, context boundaries, and structural relationships. High-dimensional vector embeddings are computed and indexed in **Qdrant Vector Cloud**, synchronized via **BullMQ** and **Upstash Redis** message queues, persisted in **PostgreSQL** via **Prisma ORM**, and served to developers through an ultra-low latency streaming chat interface powered by **Groq's Llama 3.3 70B Engine**.

---

## 🏗️ System Architecture & Engineering Highlights

RepoMind is built as a decoupled, multi-tiered distributed application engineered for high throughput, sub-second generative inference, and robust state management.

### High-Level End-to-End Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Client (Vercel)"]
        UI["React 18 SPA (Vite)"]
        Monaco["Monaco Code Editor View"]
        ChatEngine["SSE Streaming Chat Client"]
    end

    subgraph APILayer["Backend API & Compute (Render)"]
        Server["Express 5.2 Server"]
        AuthMid["OAuth & JWT Session Middleware"]
        SSEHub["Server-Sent Events Stream Hub"]
        Worker["Embedded BullMQ Ingestion Worker"]
    end

    subgraph QueueDataLayer["Queue & Message Broker"]
        Upstash["Upstash Redis (Serverless Cluster)"]
        BullMQ["BullMQ Ingestion Queue"]
    end

    subgraph VectorDatabaseLayer["Storage & Vector Infrastructure"]
        Postgres[("Supabase PostgreSQL DB (Prisma ORM)")]
        Qdrant[("Qdrant Cloud (3072-dim Vector Index)")]
    end

    subgraph ExternalServices["External Intelligence & APIs"]
        GitHubAPI["GitHub REST API (OAuth & Trees)"]
        GeminiEmbed["Google Gemini Embedding Engine"]
        GroqLLM["Groq Llama 3.3 (High-Speed LLM)"]
    end

    UI -->|"OAuth 2.0 Auth / HTTPS API"| Server
    ChatEngine -->|"POST /api/chat/stream (SSE)"| Server
    Server -->|"JWT Cookie Verification"| AuthMid
    Server -->|"Enqueue Ingestion Task"| BullMQ
    BullMQ -->|"Atomic Job Queue"| Upstash
    Worker -->|"Polls Queue Jobs"| Upstash
    Worker -->|"Fetch Tree & Source Blobs"| GitHubAPI
    Worker -->|"Generate AST Vector Embeddings"| GeminiEmbed
    Worker -->|"Upsert Vectors & Line Metadata"| Qdrant
    Worker -->|"Persist Repo & Chunk Records"| Postgres
    Server -->|"Similarity Vector Search"| Qdrant
    Server -->|"Fetch Persistent Chat History"| Postgres
    Server -->|"Stream Context-Augmented Prompt"| GroqLLM
    GroqLLM -->|"Token Stream"| SSEHub
    SSEHub -->|"Chunked Transfer Tokens"| ChatEngine
```

---

### Ingestion & AST Parsing Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Developer
    participant UI as React UI (Dashboard)
    participant API as Express API
    participant Redis as BullMQ / Redis Queue
    participant Worker as Ingestion Worker
    participant GitHub as GitHub REST API
    participant TreeSitter as WebAssembly Tree-Sitter
    participant Gemini as Gemini Embeddings
    participant Qdrant as Qdrant Vector Cloud
    participant Postgres as PostgreSQL (Prisma)

    Developer->>UI: Click 'Index Repository' or submit GitHub URL
    UI->>API: POST /api/repos { repoUrl, name }
    API->>Postgres: Upsert Repo record (status: 'QUEUED')
    API->>Redis: Enqueue BullMQ job { repoId, repoUrl }
    API-->>UI: 202 Accepted { repoId, status: 'QUEUED' }
    UI->>UI: Optimistic UI: badge 'Indexing in progress...'

    Redis->>Worker: Dispatch job to Worker
    Worker->>Postgres: UPDATE status = 'INDEXING'
    Worker->>GitHub: GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
    GitHub-->>Worker: Complete File Tree Manifest

    loop For each processable source file
        Worker->>GitHub: GET /repos/{owner}/{repo}/contents/{path} (Raw MIME)
        GitHub-->>Worker: Source code text / Base64 buffer
        Worker->>TreeSitter: Parse code using language grammar (.wasm)
        TreeSitter-->>Worker: Structured AST Chunks (StartLine, EndLine, Code)
        Worker->>Gemini: Batch generate vector embeddings (Exponential Backoff)
        Gemini-->>Worker: 3072-dimensional vector floats
        Worker->>Qdrant: Upsert points with payload { repoId, filePath, lines }
        Worker->>Postgres: Bulk insert Chunk records
    end

    Worker->>Postgres: UPDATE status = 'READY', totalFileCount, chunkCount
    Worker-->>Redis: Mark job completed
    UI->>API: Poll GET /api/user/repos
    API-->>UI: Repo status: 'READY'
    UI->>UI: Render prominent green 'Chat & Explore' button
```

---

## 🧠 Why AST-Aware Chunking Matters

### The Pitfalls of Traditional Chunking
Most off-the-shelf Retrieval-Augmented Generation (RAG) frameworks rely on **sliding-window character or token splitters** (e.g., recursive character splitting with a fixed chunk size of 1,000 characters and 100 characters of overlap). While effective for prose and news articles, this approach fails on source code:

1. **Broken Lexical Scopes**: A naive character splitter routinely severs a function in half, stranding parameters, variable definitions, and control structures in adjacent, disconnected chunks.
2. **Severed Type Hierarchies**: Interfaces, class headers, and annotations lose their enclosing scope, causing retrieval models to misinterpret method signatures.
3. **Dangling Module Imports**: Top-level imports and namespace definitions are grouped arbitrarily, removing critical context regarding which external packages and dependencies a class relies on.
4. **Hallucinated Citations**: Token-based splits cannot accurately report true line numbers, leading AI assistants to invent arbitrary code coordinates.

```
Traditional Character Splitting (Loss of Semantics):
========================================================================
[... CHUNK 1 (Arbitrary 1000 Chars) ...]
export class PaymentProcessor {
  private gateway: StripeGateway;
  constructor(apiKey: string) {
    this.gateway = new StripeGateway(apiKey);
  }
  public async executeTransaction(orderId: string, amount: number) {
-------------------- HARD CUTOFF ---------------------------------------
[... CHUNK 2 (Lost Class Scope & Types) ...]
    const session = await this.gateway.sessions.create({
      id: orderId,
      cents: amount * 100,
    });
    return session.status === 'succeeded';
  }
}
========================================================================
```

### The RepoMind AST Solution
RepoMind incorporates `web-tree-sitter` compiled to WebAssembly. When a repository file is processed:

1. The exact syntax grammar matching the source language (TypeScript, JavaScript, Python, Go, Rust, Java, C++, etc.) is loaded into memory.
2. The entire source string is parsed into an in-memory **Concrete Syntax Tree (CST)**.
3. Traversal algorithms identify syntactic boundaries:
   - `function_declaration`
   - `method_definition`
   - `class_declaration`
   - `interface_declaration`
   - `export_statement`
4. Each chunk extracted represents a **syntactically complete, self-contained unit of logic**.
5. Line markers (`startLine`, `endLine`) are preserved as first-class metadata in Qdrant payloads, enabling exact, zero-hallucination source line citations.

```
RepoMind AST-Aware Extraction:
========================================================================
>>> CHUNK #42 (Type: method_definition | Lines: 14-22 | Status: Coherent)
public async executeTransaction(orderId: string, amount: number): Promise<boolean> {
  const session = await this.gateway.sessions.create({
    id: orderId,
    cents: amount * 100,
  });
  return session.status === 'succeeded';
}
========================================================================
```

---

## ⚡ Core Features & Capabilities

- **One-Click GitHub OAuth with Enterprise Session Handling**:
  - Secure authentication via GitHub OAuth 2.0 with automatic fallbacks for private verified email resolution.
  - Cross-site JWT session management using `HttpOnly`, `Secure`, and `SameSite=None` cookies, permitting friction-free API requests across disjoint domains (`repoo-mind.vercel.app` ⇄ `repomind-server.onrender.com`).
- **Interactive Repository Dashboard**:
  - Live synchronization of a user's GitHub repositories with automated cross-referencing against PostgreSQL index states (`QUEUED`, `INDEXING`, `READY`, `FAILED`).
  - Optimistic client-side polling and state preservation preventing layout flickers.
  - Custom repository URL input for public repositories outside the user's personal organization.
  - Automatic detection of private repositories with clear UX safeguards.
- **Three-Column Developer IDE Shell**:
  - **Left Pane (File Tree Explorer)**: Interactive, searchable repository tree structure mapping all indexed files and vector chunk densities.
  - **Center Pane (Monaco Editor)**: Full-featured VS Code-style editor viewer with syntax highlighting, line numbers, and live code scrolling triggered by AI citation clicks.
  - **Right Pane (Conversational Intelligence)**: Real-time, Server-Sent Events (SSE) AI streaming interface with Markdown rendering, interactive citation pills, and Mermaid.js diagramming.
- **Sub-Second RAG Streaming with Groq Llama 3.3**:
  - Vector similarity search querying 3072-dimensional embeddings via Qdrant's cosine distance index.
  - Dynamic system prompts enforcing rigorous Mermaid quotation rules to guarantee valid diagram output.
  - Automatic extraction of inline file coordinates (`path/to/file.ts:24-48`), converting textual references into interactive highlight triggers.
- **Distributed Ingestion Queue with Resilience**:
  - BullMQ job processor backstopped by Upstash Redis, decoupling heavy repository cloning and AST parsing from the HTTP request cycle.
  - Robust exponential backoff retry algorithms to handle rate limits during batch vector generation.
  - Direct consumption of GitHub Contents REST API avoiding raw URL authentication blocks.
- **Zero Cold-Start Keep-Alive Engine**:
  - Lightweight `/api/health` endpoint engineered for external health checkers (e.g., cron-job.org or UptimeRobot) pinging every 10 minutes to eliminate free-tier container spin-down.

---

## 🛠️ Complete Tech Stack Matrix

| Layer | Technologies & Tools | Rationale & Responsibility |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18**, **Vite** | Blazing-fast HMR, component modularity, high performance production builds |
| **Styling & UI Shell** | **Tailwind CSS**, **Lucide Icons** | Polished, modern dark-mode aesthetic with zero runtime CSS overhead |
| **Code Editor** | **Monaco Editor (`@monaco-editor/react`)** | Industry-standard IDE code exploration with syntax highlighting and line decorations |
| **Panels & Layout** | **React Resizable Panels** | Fluid three-column adjustable workspace layout |
| **Diagrams & Markdown**| **Mermaid.js**, **React-Markdown**, **remark-gfm** | Live architectural diagram rendering and rich Markdown documentation presentation |
| **Backend Runtime** | **Node.js (v20+)**, **Express 5.2**, **TypeScript** | Scalable, typed RESTful API server and event streaming layer |
| **AST Parsing Engine** | **`web-tree-sitter` (WASM)** | Native grammar parsing preserving function, class, and interface boundaries |
| **Vector Database** | **Qdrant Cloud** | Sub-millisecond HNSW vector indexing with payload filtering for multi-tenant repos |
| **Relational Database**| **PostgreSQL (Supabase)**, **Prisma ORM** | Relational data integrity for users, repository states, and persistent chat sessions |
| **Queue & Cache** | **BullMQ**, **Upstash Redis (Serverless)** | Asynchronous, resilient background job processing isolated from API threads |
| **Embeddings** | **Google Gemini `text-embedding-004`** | 3072-dimensional vector representations capturing deep syntactic code semantics |
| **LLM Inference** | **Groq Llama 3.3 70B Engine** | Ultra-high throughput token streaming (500+ tokens/sec) via OpenAI SDK compatibility |
| **Authentication** | **GitHub OAuth 2.0**, **JWT (`jsonwebtoken`)** | Cryptographically signed, cross-site HTTP-only cookies with verified email resolution |
| **Cloud Hosting** | **Vercel** (Client), **Render** (Server) | Global Edge CDN distribution for client assets paired with cloud compute services |

---

## 📡 Comprehensive API Reference

### Health & Monitoring
```http
GET /api/health
```
- **Auth Required**: No
- **Description**: Returns lightweight system status and uptime for synthetic monitoring and cron keep-alive pings.
- **Response**:
```json
{
  "status": "ok",
  "uptime": 1420.58
}
```

---

### Authentication (`/api/auth`)
```http
GET /api/auth/github
```
- **Description**: Redirects user to GitHub OAuth login consent page with `read:user`, `user:email`, and `repo` scopes.

```http
GET /api/auth/github/callback?code={authorization_code}
```
- **Description**: Exchanges GitHub code for an access token, fetches profile details, upserts PostgreSQL user, issues a signed JWT cookie (`auth_token`), and redirects to `/dashboard`.

```http
GET /api/auth/me
```
- **Auth Required**: Yes (`auth_token` cookie or Bearer token)
- **Response**:
```json
{
  "user": {
    "id": "c1f7b09b-6d53-4b61-9dc5-49281a70ff5d",
    "email": "developer@example.com",
    "createdAt": "2026-10-11T04:22:18.000Z"
  }
}
```

```http
POST /api/auth/logout
```
- **Description**: Clears authentication cookie with matching `SameSite=None; Secure` flags.

---

### Repositories (`/api/repos` & `/api/user`)
```http
GET /api/user/repos
```
- **Auth Required**: Yes
- **Description**: Queries live GitHub repositories for the authenticated user and cross-references indexing status in PostgreSQL.
- **Response (Array)**:
```json
[
  {
    "name": "RepoMind",
    "full_name": "vikassalgude/RepoMind",
    "description": "AST-aware RAG codebase intelligence platform for GitHub repositories.",
    "isPrivate": false,
    "html_url": "https://github.com/vikassalgude/RepoMind",
    "default_branch": "main",
    "language": "TypeScript",
    "isIndexed": true,
    "repoId": "d3b07384-d113-46fb-9c88-e215e44a4915",
    "status": "READY"
  }
]
```

```http
POST /api/repos
```
- **Auth Required**: Yes
- **Payload**:
```json
{
  "repoUrl": "https://github.com/vikassalgude/RepoMind",
  "name": "vikassalgude/RepoMind"
}
```
- **Response (202 Accepted)**:
```json
{
  "message": "Repository queued for processing",
  "repoId": "d3b07384-d113-46fb-9c88-e215e44a4915"
}
```

```http
GET /api/repos/:id
```
- **Description**: Returns repository metadata and indexed AST code chunks.
- **Response**:
```json
{
  "id": "d3b07384-d113-46fb-9c88-e215e44a4915",
  "name": "vikassalgude/RepoMind",
  "githubUrl": "https://github.com/vikassalgude/RepoMind",
  "branch": "main",
  "status": "READY",
  "chunkCount": 78,
  "indexedFileCount": 14,
  "totalFileCount": 14,
  "chunks": [
    {
      "id": "a91b...",
      "filePath": "server/src/utils/chunker.ts",
      "startLine": 28,
      "endLine": 64,
      "language": "TYPESCRIPT",
      "content": "export async function generateASTChunks(code: string, lang: Language) { ... }"
    }
  ]
}
```

---

### Conversational Intelligence (`/api/chat`)
```http
POST /api/chat/stream
```
- **Auth Required**: Yes
- **Headers**: `Accept: text/event-stream`
- **Payload**:
```json
{
  "repoId": "d3b07384-d113-46fb-9c88-e215e44a4915",
  "query": "How does the AST chunker handle unsupported language files?",
  "messages": []
}
```
- **Streaming Response**: Continuous Server-Sent Events (`data: {"text": "..."}\n\n`) culminating with `data: [DONE]\n\n`.
- **Side Effect**: Automatically stores user prompt and synthesized assistant response (including structured citation objects) in PostgreSQL.

```http
GET /api/chat/:repoId/messages
```
- **Auth Required**: Yes
- **Description**: Hydrates persistent conversation history for a specific repository.
- **Response**:
```json
{
  "conversationId": "50e93...",
  "messages": [
    {
      "id": "msg-176051...",
      "sender": "user",
      "text": "Explain the architecture of the queue worker.",
      "createdAt": "2026-10-15T06:14:00.000Z"
    },
    {
      "id": "msg-176052...",
      "sender": "ai",
      "text": "The worker utilizes BullMQ connected to Upstash Redis...",
      "citations": [
        {
          "path": "server/src/workers/ingestionWorker.ts",
          "startLine": 12,
          "endLine": 45,
          "description": "Source Citation"
        }
      ],
      "createdAt": "2026-10-15T06:14:02.000Z"
    }
  ]
}
```

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **Package Manager**: `npm` (v10+)
- **Redis Server**: Local instance on port `6379` or Upstash Redis URL
- **PostgreSQL Database**: Local or managed instance (Supabase/Neon)
- **API Credentials**:
  - GitHub OAuth Application (`Client ID` and `Client Secret`)
  - Google Gemini API Key
  - Groq Cloud API Key
  - Qdrant Cloud Cluster URL & API Key

---

### 2. Repository Cloning
```bash
git clone https://github.com/vikassalgude/RepoMind.git
cd RepoMind
```

---

### 3. Backend Setup (`/server`)

1. **Navigate and install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Configure Environment Variables**:
   Create `server/.env` with the following keys:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173

   # GitHub OAuth Credentials
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

   # Session Security
   JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters

   # PostgreSQL Database (Prisma)
   DATABASE_URL="postgresql://postgres:password@localhost:5432/repomind?schema=public"

   # Redis / BullMQ Connection
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_TLS=false

   # Qdrant Vector Cloud
   QDRANT_URL=https://your-cluster-url.qdrant.tech
   QDRANT_API_KEY=your_qdrant_api_key

   # AI Inference & Embeddings
   GEMINI_API_KEY=your_google_gemini_api_key
   GROQ_API_KEY=your_groq_api_key
   ```

3. **Initialize Database Schema via Prisma**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start the API Server**:
   ```bash
   npm run dev
   ```
   *The server starts on `http://localhost:3000` with the BullMQ worker embedded.*

---

### 4. Frontend Setup (`/client`)

1. **Navigate and install dependencies**:
   ```bash
   cd ../client
   npm install
   ```

2. **Configure Environment Variables**:
   Create `client/.env`:
   ```env
   VITE_API_URL=http://localhost:3000
   ```

3. **Launch the Development Server**:
   ```bash
   npm run dev
   ```
   *Visit `http://localhost:5173` to explore RepoMind locally.*

---

## 🔒 Production Security & Deployment Hardening

1. **SameSite=None Cross-Origin Cookie Architecture**:
   Modern browsers block cross-origin credentials by default. Because the client is hosted on Vercel (`https://repoo-mind.vercel.app`) and the backend is on Render (`https://repomind-server.onrender.com`), authentication cookies require:
   ```typescript
   res.cookie('auth_token', token, {
     httpOnly: true,
     secure: true,
     sameSite: 'none',
     path: '/',
     maxAge: 7 * 24 * 60 * 60 * 1000
   });
   ```
2. **CORS Sanitization**:
   The backend dynamically strips trailing slashes from `process.env.CLIENT_URL` to prevent preflight CORS failures (`403 Forbidden`) caused by browser `Origin` headers lacking trailing slashes.
3. **SPA Catch-All Route Rewriting**:
   To ensure client-side routing (`/dashboard`, `/chat/:repoId`) functions seamlessly on page refresh, a root `vercel.json` provides rewrite rules:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
4. **Resilient Rate-Limit Backoff**:
   Embeddings are dispatched with exponential backoff algorithms that gracefully handle `429 Too Many Requests` responses from vector providers.

---

## 📄 License
This project is licensed under the **ISC License**. Developed by [Vikas Salgude](https://github.com/vikassalgude).
