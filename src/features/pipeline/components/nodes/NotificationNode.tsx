/**
 * NotificationNode - Alert and notification output node
 * Receives signals and sends notifications via various channels
 */

import { memo, useState } from 'react';
import { Position } from '@xyflow/react';
import { Bell, Send, Check, Mail, MessageSquare, Smartphone, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { BaseNode } from './BaseNode';
import { NotificationNodeData } from '../../types';
import { usePipelineStore } from '../../store/pipelineStore';

interface NotificationNodeProps {
  id: string;
  data: NotificationNodeData;
  selected?: boolean;
}

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: Smartphone },
  { id: 'telegram', label: 'Telegram', icon: MessageSquare },
  { id: 'discord', label: 'Discord', icon: MessageSquare },
  { id: 'webhook', label: 'Webhook', icon: Webhook },
] as const;

export const NotificationNode = memo(({ id, data, selected }: NotificationNodeProps) => {
  const [testSent, setTestSent] = useState(false);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const toggleChannel = (channelId: string) => {
    const channels = data.channels || [];
    const updated = channels.includes(channelId)
      ? channels.filter((c) => c !== channelId)
      : [...channels, channelId];
    updateNodeData<NotificationNodeData>(id, { channels: updated });
  };

  const sendTestNotification = async () => {
    if (!data.channels?.length) return;
    
    setTestSent(true);
    
    // Simulate sending
    await new Promise((r) => setTimeout(r, 1000));
    
    updateNodeData<NotificationNodeData>(id, {
      lastNotification: {
        timestamp: new Date().toISOString(),
        message: 'Test notification sent successfully',
        channel: data.channels[0],
      },
    });
    
    setTimeout(() => setTestSent(false), 2000);
  };

  const getChannelIcon = (channelId: string) => {
    const channel = CHANNELS.find((c) => c.id === channelId);
    if (!channel) return null;
    const Icon = channel.icon;
    return <Icon className="w-3 h-3" />;
  };

  return (
    <BaseNode
      title="Notification"
      icon={<Bell className="w-4 h-4" />}
      color="#ec4899"
      selected={selected}
      status={data.isActive ? 'running' : 'idle'}
      statusText={data.isActive ? 'Active' : 'Paused'}
      handles={[
        { id: 'signal-in', type: 'target', position: Position.Left, color: '#8b5cf6' },
      ]}
    >
      <div className="space-y-2.5">
        {/* Active Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Notifications Active
          </label>
          <Switch
            checked={data.isActive}
            onCheckedChange={(v) => updateNodeData<NotificationNodeData>(id, { isActive: v })}
            className="scale-75"
          />
        </div>

        {/* Channel Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Channels
          </label>
          <div className="grid grid-cols-3 gap-1">
            {CHANNELS.map((channel) => {
              const isActive = data.channels?.includes(channel.id);
              const Icon = channel.icon;
              return (
                <Button
                  key={channel.id}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 text-[10px] ${isActive ? '' : 'text-muted-foreground'}`}
                  onClick={() => toggleChannel(channel.id)}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {channel.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Channel-specific config */}
        {data.channels?.includes('email') && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Email Address</label>
            <Input
              type="email"
              value={data.config?.email || ''}
              onChange={(e) => updateNodeData<NotificationNodeData>(id, { 
                config: { ...data.config, email: e.target.value }
              })}
              className="h-7 text-xs"
              placeholder="your@email.com"
            />
          </div>
        )}

        {data.channels?.includes('telegram') && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Telegram Chat ID</label>
            <Input
              value={data.config?.telegramChatId || ''}
              onChange={(e) => updateNodeData<NotificationNodeData>(id, { 
                config: { ...data.config, telegramChatId: e.target.value }
              })}
              className="h-7 text-xs font-mono"
              placeholder="-100123456789"
            />
          </div>
        )}

        {data.channels?.includes('webhook') && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Webhook URL</label>
            <Input
              type="url"
              value={data.config?.webhookUrl || ''}
              onChange={(e) => updateNodeData<NotificationNodeData>(id, { 
                config: { ...data.config, webhookUrl: e.target.value }
              })}
              className="h-7 text-xs"
              placeholder="https://..."
            />
          </div>
        )}

        {/* Message Template */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Message Template
          </label>
          <Textarea
            value={data.messageTemplate}
            onChange={(e) => updateNodeData<NotificationNodeData>(id, { messageTemplate: e.target.value })}
            className="text-xs min-h-[50px] resize-none"
            placeholder="Signal: {{signal}} at {{price}} for {{symbol}}"
          />
          <div className="text-[9px] text-muted-foreground">
            Use <code className="px-1 py-0.5 bg-muted rounded">{'{{signal}}'}</code>, 
            <code className="px-1 py-0.5 bg-muted rounded ml-1">{'{{price}}'}</code>, 
            <code className="px-1 py-0.5 bg-muted rounded ml-1">{'{{symbol}}'}</code>
          </div>
        </div>

        {/* Test Button */}
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs"
          onClick={sendTestNotification}
          disabled={!data.channels?.length || testSent}
        >
          {testSent ? (
            <>
              <Check className="w-3 h-3 mr-1 text-green-500" />
              Test Sent!
            </>
          ) : (
            <>
              <Send className="w-3 h-3 mr-1" />
              Send Test
            </>
          )}
        </Button>

        {/* Last Notification */}
        {data.lastNotification && (
          <div className="p-2 bg-muted/30 rounded text-[10px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground">Last Sent</span>
              <Badge variant="outline" className="text-[8px] h-3 gap-0.5">
                {getChannelIcon(data.lastNotification.channel)}
                {data.lastNotification.channel}
              </Badge>
            </div>
            <div className="text-muted-foreground truncate">
              {data.lastNotification.message}
            </div>
            <div className="text-[9px] text-muted-foreground/60 mt-0.5">
              {new Date(data.lastNotification.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

NotificationNode.displayName = 'NotificationNode';
