<div align="center">
  <h1>Gemini CLI UI</h1>
</div>

A desktop and mobile UI for [Gemini CLI](https://github.com/google-gemini/gemini-cli), Google's official CLI for AI-assisted coding. You can use it locally or remotely to view your active projects and sessions in Gemini CLI and make changes to them the same way you would do it in Gemini CLI. This gives you a proper interface that works everywhere.

## Features

- **Responsive Design** - Works seamlessly across desktop, tablet, and mobile so you can also use Gemini CLI from mobile
- **Multiple UI Modes** - Switch between distinct visual themes including default Gemini, ChatGPT, and Shadcn Assistant (assistant-ui style)
- **Interactive Chat Interface** - Built-in chat interface for seamless communication with Gemini CLI
- **File Explorer** - Interactive file tree with live file references
- **Session Management** - Resume conversations, manage multiple sessions, and track history
- **Model Selection** - Choose from multiple Gemini models including Gemini 2.5 Pro and Flash
- **YOLO Mode** - Auto Approve mode for faster operations (use with caution)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed and configured

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/jinkun1998/Gemini-CLI-UI.git
cd Gemini-CLI-UI
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the application:**
```bash
# Start both the backend API and the frontend Vite server
npm run dev
```

4. **Open your browser:**
   - Development: `http://localhost:5173`

## Usage Guide

### Core Features

#### Project Management
The UI automatically discovers Gemini CLI projects from your local system:
- **Visual Project Browser** - All available projects with metadata and session counts
- **Project Actions** - Create new projects or select existing folders

#### Chat Interface
- **Real-time Communication** - Stream responses from Gemini with WebSocket connection
- **Session Management** - Resume previous conversations or start fresh sessions
- **Message History** - Complete conversation history with markdown support
- **Multi-format Support** - Text, code blocks (with Collapsible Code), and Mermaid diagrams

#### Model Configuration
- Switch seamlessly between Gemini models (Gemini 3.1 Pro Preview, 2.5 Pro, 2.5 Flash, etc.)
- **Auto Fallback** - If a quota error occurs, the UI will automatically retry with a fallback model and update your settings.

## Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │  Gemini CLI     │
│   (React/Vite)  │◄──►│ (Express/WS)    │◄──►│  Integration    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

The codebase is structured as an npm workspace (monorepo):
- `apps/web/`: Frontend React application using Vite and Tailwind CSS.
- `apps/api/`: Node.js Express backend and WebSocket server for real-time model streaming and CLI integration.

### Backend (Node.js + Express)
- **Express Server** - RESTful API
- **WebSocket Server** - Communication for streaming chats
- **Gemini CLI Integration** - Process spawning and pty management

### Frontend (React + Vite)
- **React 19** - Modern component architecture with hooks
- **Tailwind CSS v4** - Utility-first CSS framework
- **Responsive Design** - Clean interface optimized for code review

## Acknowledgments

### Built With
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** - Google's official CLI
- **[React](https://react.dev/)** - User interface library
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework

## Support & Community

### Stay Updated
- **Star** this repository to show support
- **Watch** for updates and new releases
- **Follow** the project for announcements
