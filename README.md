# FailFixes — Experiential Learning Platform

<div align="center">

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Material-UI](https://img.shields.io/badge/Material--UI-0081CB?style=for-the-badge&logo=mui&logoColor=white)

A full-stack MERN application for experiential learning through real-time collaboration and story sharing.

</div>

## 🔗 Live Demo

- Frontend: https://failfixes.onrender.com
- Backend API (optional): https://failfixes-backend1.onrender.com

## 🎯 About

FailFixes is an experiential learning platform that enables users to share experiences, learn from failures, and connect with peers in real-time. Built with the MERN stack, emphasizing performance, scalability, and user engagement.

## ✨ Features

### Core Functionality
- **User Feed System**: Browse and interact with community stories
- **Real-Time Messaging**: Instant communication powered by Socket.io
- **Story Sharing**: Create, read, and engage with learning content
- **User Profiles**: Personalized profiles with activity tracking

### Technical Highlights
- **WebSocket Communication**: Real-time messaging with automatic reconnection
- **Redis Caching**: 57% faster response times (342ms → 146ms)
- **Responsive Design**: Mobile-first UI with Material-UI
- **RESTful API**: Route-controller-service architecture
- **Message Persistence**: Chat history stored in MongoDB

## 🛠️ Tech Stack

### Frontend
- React.js  
- Material-UI  
- Axios  
- Socket.io-client  

### Backend
- Node.js  
- Express.js  
- MongoDB + Mongoose  
- Socket.io  
- Redis  

### DevOps & Tools
- GitHub Actions  
- ESLint  
- Jest  
- Docker  

## 🏗️ Architecture

The application follows MVC architecture with clear separation of concerns:

- Frontend (React.js) ↔ HTTP/WebSocket ↔ Backend (Node.js)  
- MongoDB: Data persistence  
- Redis: Caching layer  
- Socket.io: Real-time communication  

Backend structure (conceptual):

- `routes/` – API endpoint definitions  
- `controllers/` – Request handling logic  
- `services/` – Business logic layer  
- `models/` – Database schemas  
- `middlewares/` – Custom middleware functions  

## 🚀 Installation

### Prerequisites

- Node.js (v14 or higher)  
- MongoDB (v4.4 or higher)  
- Redis (v6 or higher)  
- npm or yarn  

### Clone the Repository

- `git clone https://github.com/MOKSHA021/FailFixes.git`  
- `cd FailFixes`  

### Backend Setup

- `cd backend`  
- `npm install`  
- `npm start`  

Backend runs at: `http://localhost:5000`

### Frontend Setup

- `cd frontend`  
- `npm install`  
- `npm start`  

Frontend runs at: `http://localhost:3000`

### Redis Setup

- Install Redis (example Ubuntu/Debian): `sudo apt-get install redis-server`  
- Start Redis: `redis-server`  
- Verify: `redis-cli ping` → `PONG`  

## 🔐 Environment Variables

Backend `.env` (example):

- `PORT=5000`  
- `MONGODB_URI=mongodb://localhost:27017/failfixes`  
- `REDIS_HOST=localhost`  
- `REDIS_PORT=6379`  
- `JWT_SECRET=your_secret_key`  
- `FRONTEND_URL=http://localhost:3000`  

Frontend `.env` (example):

- `REACT_APP_API_URL=http://localhost:5000`  
- `REACT_APP_SOCKET_URL=http://localhost:5001`  

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` – Register new user  
- `POST /api/auth/login` – Login user  
- `GET /api/auth/me` – Get current user  

### Stories

- `GET /api/stories` – Get all stories (cached)  
- `GET /api/stories/:id` – Get story by ID  
- `POST /api/stories` – Create new story  
- `PUT /api/stories/:id` – Update story  
- `DELETE /api/stories/:id` – Delete story  

### WebSocket Events (client)

- `socket.emit('join_room', { roomId })`  
- `socket.emit('send_message', { roomId, message })`  
- `socket.on('receive_message', handler)`  

## ⚡ Performance

- Response time: 57% improvement (342ms → 146ms)  
- Query speed: 2.34× faster with Redis caching  
- High cache hit ratio for story endpoints  

## 📁 Project Structure (High-Level)

- `backend/` – API, WebSocket server, Redis, MongoDB  
- `frontend/` – React app (pages, components, services)  
- `.github/workflows/` – CI/CD pipelines  

## 🔄 CI/CD Pipeline

Automated with GitHub Actions:

- ESLint checks  
- Unit & integration tests (Jest)  
- Build verification  
- Ephemeral MongoDB test instances  


## 📝 License

MIT License – see `LICENSE` file for details.

## 📧 Contact

- Author: **MOKSHA021**  
- GitHub: https://github.com/MOKSHA021  
- Project: https://github.com/MOKSHA021/FailFixes

