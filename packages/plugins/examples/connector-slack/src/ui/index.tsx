import React from "react";

export function SettingsPage() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Slack Connector Settings</h2>
      <p>Configure your Slack integration in the plugin instance settings above.</p>
      <h3>Setup Instructions</h3>
      <ol>
        <li>Create a Slack App at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">api.slack.com/apps</a></li>
        <li>Add Bot Token Scopes: <code>chat:write</code>, <code>reactions:read</code>, <code>commands</code></li>
        <li>Install to your workspace and copy the Bot User OAuth Token</li>
        <li>Add the token as a Paperclip secret and reference it in the <strong>Bot Token Reference</strong> field</li>
        <li>Set up Event Subscriptions URL: <code>{"{your-paperclip-url}"}/api/plugins/connector-slack/webhooks/slack-events</code></li>
        <li>Set up Interactivity URL: <code>{"{your-paperclip-url}"}/api/plugins/connector-slack/webhooks/slack-interactive</code></li>
        <li>Set up Slash Command URL: <code>{"{your-paperclip-url}"}/api/plugins/connector-slack/webhooks/slack-commands</code></li>
      </ol>
      <h3>Available Slash Commands</h3>
      <ul>
        <li><code>/paperclip create [title]</code> — Create a new issue</li>
        <li><code>/paperclip status</code> — Show active issues</li>
        <li><code>/paperclip agents</code> — List agents and their status</li>
        <li><code>/paperclip help</code> — Show all commands</li>
      </ul>
      <h3>Emoji Reactions</h3>
      <ul>
        <li>✅ — Mark done</li>
        <li>🚀 — Start (in progress)</li>
        <li>🔴 — Block</li>
        <li>👀 — In review</li>
        <li>🚫 — Cancel</li>
      </ul>
    </div>
  );
}
