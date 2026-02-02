import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });
await server.register(formbody);

await buildApp(server);

await server.listen({ port: env.PORT, host: "0.0.0.0" });

server.log.info(`Atlas running on port ${env.PORT}`);
