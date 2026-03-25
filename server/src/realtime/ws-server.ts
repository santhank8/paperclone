import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { validateWsToken } from './ws-middleware.js';

export interface WSMessage {
  type: 'agent_status' | 'task_update' | 'mission_progress' | 'notification' | 'ping';
  payload: any;
  companyId?: string;
  timestamp: string;
}

export class RealtimeServer {
 private wss: WebSocketServer;
 private clients: Map<string, Set<WebSocket>> = new Map(); // companyId -> clients

 constructor(server: Server) {
   this.wss = new WebSocketServer({ 
     server,
     path: '/ws'
   });

   this.wss.on('connection', (ws: WebSocket, req) => {
     const url = parse(req.url || '', true);
     const companyId = url.query.companyId as string;
     const token = url.query.token as string;

     // Validate token and extract user info
     const authResult = validateWsToken(token || '');
     if (!authResult.valid || !companyId) {
       ws.close(4000, 'Authentication failed');
       return;
     }

     // Register client
     if (!this.clients.has(companyId)) {
       this.clients.set(companyId, new Set());
     }
     this.clients.get(companyId)!.add(ws);

     // Send welcome message
     ws.send(JSON.stringify({
       type: 'ping',
       payload: 'Welcome to Paperclip WebSocket server'
     }));

     ws.on('close', () => {
       this.clients.get(companyId)?.delete(ws);
     });

     // Set initial alive status for heartbeat
     (ws as any).isAlive = true;
   });

   // Heartbeat/Health check mechanism
   const heartbeatInterval = setInterval(() => {
     this.wss.clients.forEach((ws: any) => {
       if (ws.isAlive === false) {
         return ws.terminate();
       }
       ws.isAlive = false;
       ws.ping();
     });
   }, 30000); // 30 seconds

   // Clear heartbeat interval on server close
   this.wss.on('close', () => {
     clearInterval(heartbeatInterval);
   });

   // Handle ping responses
   this.wss.on('connection', (ws) => {
     ws.on('pong', () => {
       (ws as any).isAlive = true;
     });
   });
 }

 broadcast(companyId: string, message: WSMessage) {
   const clients = this.clients.get(companyId);
   if (!clients) return;

   const data = JSON.stringify(message);
   clients.forEach(client => {
     if (client.readyState === WebSocket.OPEN) {
       client.send(data);
     }
   });
 }

 // Convenience methods for different event types
 emitAgentStatus(companyId: string, agentId: string, status: string) {
   this.broadcast(companyId, {
     type: 'agent_status',
     payload: { agentId, status, timestamp: new Date().toISOString() },
     companyId,
     timestamp: new Date().toISOString()
   });
 }

 emitTaskUpdate(companyId: string, taskId: string, changes: any) {
   this.broadcast(companyId, {
     type: 'task_update',
     payload: { taskId, ...changes, timestamp: new Date().toISOString() },
     companyId,
     timestamp: new Date().toISOString()
   });
 }

 emitMissionProgress(companyId: string, missionId: string, progress: any) {
   this.broadcast(companyId, {
     type: 'mission_progress',
     payload: { missionId, progress, timestamp: new Date().toISOString() },
     companyId,
     timestamp: new Date().toISOString()
   });
 }

 emitNotification(companyId: string, notification: any) {
   this.broadcast(companyId, {
     type: 'notification',
     payload: { ...notification, timestamp: new Date().toISOString() },
     companyId,
     timestamp: new Date().toISOString()
   });
 }
}