# Retrokit

Herramienta de retrospectivas para equipos (inspirada en Neatro): flujo Comentarios → Agrupar → Votar → Plan de acción → ROTI, con plantillas, límites de facilitación y tablero de acciones.

## Stack

- **Frontend:** Angular 22 + Socket.IO client (paleta trinom.io)
- **Backend:** NestJS 11 + Prisma + PostgreSQL 16 + Socket.IO
- **Deploy:** Docker Compose (`web` + `api` + `db`)

## Arranque con Docker (servidor local)

Requisitos: Docker y Docker Compose v2.

```bash
cd /Users/macbook/Documents/retrokit
cp .env.example .env   # si aún no existe .env
docker compose up --build
```

Abre **http://localhost:8080** (o el puerto que configures con `HOST_PORT` en `.env`; en este entorno de ejemplo puede ser `8090` si 8080 está ocupado).

Nginx sirve el frontend y hace proxy de `/api` y `/socket.io` hacia el backend. Al arrancar, la API aplica migraciones Prisma y siembra las 5 plantillas.

### Servicios

| Servicio | Contenedor | Puerto host |
|----------|------------|-------------|
| Web (Angular + Nginx) | `web` | `8080` → 80 |
| API (NestJS) | `api` | interno 3000 |
| Postgres | `db` | interno 5432 (volumen `postgres_data`) |

## Desarrollo local (sin Docker de apps)

1. Levanta solo la base:

```bash
docker compose up db -d
```

2. Backend (Node ≥ 22.22):

```bash
cd backend
cp ../.env.example .env.local   # opcional
export DATABASE_URL=postgresql://retrokit:retrokit@localhost:5432/retrokit?schema=public
# Expón Postgres al host si hace falta, o:
docker compose up db -d
# Añade ports en compose para db si desarrollas fuera de la red Docker:
# "5432:5432"
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

3. Frontend:

```bash
cd frontend
npm start
```

`ng serve` usa `proxy.conf.json` hacia `http://localhost:3000`.

## Uso rápido

1. Regístrate en `/register`
2. Crea un equipo en el dashboard
3. En el equipo, elige plantilla y límites (comentarios / votos)
4. Comparte el enlace de invitado desde la sala
5. Avanza fases como facilitador; en Plan de acción ordena por más votados
6. Cierra con ROTI y revisa el reporte imprimible
7. Sigue acciones en `/teams/:id/actions`

## Plantillas incluidas

- Start / Stop / Continue
- 4Ls
- Mad / Sad / Glad
- Keep / Drop / Start
- Went Well / To Improve / Ideas

## Variables de entorno

Ver `.env.example`:

- `JWT_SECRET` — secreto JWT (cámbialo en producción)
- `DATABASE_URL` — conexión Postgres
- `CORS_ORIGIN` — origen permitido (URL del frontend)
- `HOST_PORT` — puerto publicado del frontend

## Estructura

```
retrokit/
  frontend/     Angular 22
  backend/      NestJS + Prisma
  docker-compose.yml
  .env.example
```
