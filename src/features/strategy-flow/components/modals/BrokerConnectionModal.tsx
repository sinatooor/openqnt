import { useState } from 'react';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { Loader2, Plug, Save } from 'lucide-react';

interface BrokerConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokerId: string;
  brokerName: string;
  onConnected: () => void;
}

export const BrokerConnectionModal = ({
  open,
  onOpenChange,
  brokerId,
  brokerName,
  onConnected
}: BrokerConnectionModalProps) => {
  const [alias, setAlias] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConnect = async () => {
    if (!alias || !apiKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.storeCredential({
        alias,
        provider: brokerId,
        apiKey,
        apiSecret: apiSecret || undefined,
      });
      toast.success(`Connected to ${brokerName}`);
      onConnected();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to connect broker');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Connect ${brokerName}`}
      icon={<Plug className="w-5 h-5" />}
      defaultWidth={400}
      defaultHeight={350}
    >
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Connection Alias</Label>
          <Input
            placeholder="My Main Account"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder="Enter API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>API Secret</Label>
          <Input
            type="password"
            placeholder="Enter API Secret (Optional)"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
          />
        </div>

        <div className="pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Connect
              </>
            )}
          </Button>
        </div>
      </div>
    </WindowModal>
  );
};
