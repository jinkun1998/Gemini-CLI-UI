<div align="center">
  <h1>Gemini CLI UI</h1>
</div>

A desktop and mobile UI for [Gemini CLI](https://github.com/google-gemini/gemini-cli), Google's official CLI for AI-assisted coding. You can use it locally or remotely to view your active projects and sessions in Gemini CLI and make changes to them the same way you would do it in Gemini CLI. This gives you a proper interface that works everywhere.

## Features

- **Responsive Design** - Works seamlessly across desktop, tablet, and mobile so you can also use Gemini CLI from mobile.
- **Multiple UI Modes** - Switch between distinct visual themes including **Gemini (Default)**, **ChatGPT**, and **Shadcn Assistant** (assistant-ui.com style).
- **Hierarchical Execution Policies** - Set command approval levels at the **Global**, **Project**, or **Chat** level. Overrides follow the hierarchy: Chat > Project > Global.
- **Custom Tool Permissions** - Granularly toggle auto-approval for specific tools (e.g., auto-approve Read/Search but require confirmation for Write/Shell commands).
- **Interactive Chat Interface** - Real-time WebSocket communication with official Gemini logo avatars and markdown support.
- **Visual Polish** - Smooth circular reveal animations for theme switching and "Slack-style" double-knock sound notifications when responses finish.
- **File Explorer** - Interactive file tree with live file references and @mentions support in chat.
- **Session Management** - Resume conversations, manage multiple sessions, and track history.
- **Model Selection** - Choose from multiple Gemini models including Gemini 3.1 Pro, 2.5 Flash, and more with automatic quota fallback.

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
- **Visual Project Browser** - All available projects with metadata and session counts.
- **Project Overrides** - Set custom execution policies per project in the Settings menu.

#### Chat Interface
- **Real-time Communication** - Stream responses from Gemini with WebSocket connection.
- **Policy Toggles** - Quickly switch the execution policy (Ask/Safe/YOLO) for the current chat directly in the header.
- **Interactive Approvals** - In restricted environments, the UI provides "Approve Action" buttons for manual confirmation of agent tasks.
- **Multi-format Support** - Text, code blocks (with Collapsible Code), and Mermaid diagrams.

#### Security & Permissions
- **Granular Control** - Use the "Custom permissions" policy to define exactly which tools the agent can use silently.
- **Safe Mode Support** - Built-in fallback system to handle manual approvals when terminal access is restricted.

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
- **Express Server** - RESTful API for project/chat management.
- **WebSocket Server** - Handles streaming communication and interactive terminal sessions.
- **Gemini CLI Integration** - Process spawning and approval mode management.

### Frontend (React + Vite)
- **React 19** - Modern component architecture with hooks and View Transitions.
- **Tailwind CSS v4** - Utility-first CSS framework for rapid styling.
- **UI Mode Registry** - Pluggable architecture for different interface styles (Gemini, ChatGPT, Shadcn).

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
