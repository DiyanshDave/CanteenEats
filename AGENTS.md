# Repository Guidelines

## Project Structure & Module Organization

This repository contains two apps. `backend/src/` is an Express API organized by responsibility: `routes/`, `controllers/`, `models/`, `middleware/`, and `services/`. `frontend/src/` is a React/Vite client, with screens in `pages/`, shared UI in `components/` and `layouts/`, app state in `context/`, routing in `routes/`, and API calls in `services/`. API behavior is documented in `docs/API_CONTRACT.md`; Postman workspace files are under `postman/`.

## Build, Test, and Development Commands

Install dependencies in each app directory with `npm install`.

- Backend: `cd backend && npm run dev` starts the API with Node watch mode; `npm start` runs it normally.
- Frontend: `cd frontend && npm run dev` starts Vite; `npm run build` creates the production bundle; `npm run preview` serves that bundle locally.

There are currently no test or lint scripts in either package. Run the frontend build after UI changes and manually exercise affected API flows until automated tests are added.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: ES modules, two-space indentation, semicolons, and single quotes in backend files. Use `PascalCase` for React component files and model classes (for example, `StudentDashboard.jsx`, `Order.js`); use `camelCase` for functions, variables, and controller/service files. Keep route handlers thin and put business logic in controllers or services, consistent with nearby code.

## Testing Guidelines

No test framework or coverage requirement is configured. For changes, verify the relevant app starts and check the affected user flow or endpoint. Use `docs/API_CONTRACT.md` and the Postman files as references when validating API request and response shapes. Add tests alongside future test infrastructure using descriptive names tied to the behavior under test.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, often prefixed with `Add` (for example, `Add working analytics API`). Follow that pattern with a concise description of the change. Pull requests should explain the user-visible or API impact, list setup or verification steps, link related issues when available, and include screenshots for frontend changes. Call out configuration or API contract changes explicitly.

## Security & Configuration

Copy `backend/.env.example` and `frontend/.env.example` into local environment files as needed. Keep database credentials and `JWT_SECRET` private; never commit real secrets. Coordinate backend port, client URL, and frontend API URL when running both apps locally.
