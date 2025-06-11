#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { connectToMongoDB, closeMongoDB } from "./mongodb/client.js";
import { ToolRegistry } from "./tools/registry.js";

const databaseUrl = process.env.MONGO_URI;
if (!databaseUrl) {
  console.error("MONGO_URI environment variable is not set");
  process.exit(1);
}

const toolRegistry = new ToolRegistry();

const server = new McpServer(
  {
    name: "mongodb-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {
        list: true,
        call: true,
      },
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolRegistry.getToolSchemas(),
  _meta: {},
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    console.error(`Executing tool: ${name}`);
    console.error(`Arguments: ${JSON.stringify(args, null, 2)}`);

    const tool = toolRegistry.getTool(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const result = await tool.execute(args);
    return { toolResult: result };
  } catch (error) {
    console.error("Operation failed:", error);
    return {
      toolResult: {
        content: [
          {
            type: "text",
            text: error.message,
          },
        ],
        isError: true,
      },
    };
  }
});

async function runServer() {
  await connectToMongoDB(databaseUrl);

  const app = express();
  const transport = new StreamableHTTPServerTransport();

  app.post("/mcp", express.json(), async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    await transport.handleRequest(req, res);
  });

  const port = process.env.PORT || 3333;
  app.listen(port, () => {
    console.log(`MongoDB MCP HTTP server running at http://localhost:${port}/mcp`);
  });
}

process.on("SIGINT", async () => {
  try {
    await closeMongoDB();
  } finally {
    process.exit(0);
  }
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
  process.exit(1);
});

runServer().catch(console.error);
