/**
 * ContextMenu - Right-click context menu for nodes
 */

import { memo, useEffect, useRef } from 'react';
import { Copy, Edit3, Lock, Unlock, Trash2, Plus, Scissors, Clipboard } from 'lucide-react';
import { useStrategyFlowStore } from '../store/strategyFlowStore';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
}

export const ContextMenu = memo(({ x, y, nodeId, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { 
    nodes, 
    duplicateNode, 
    deleteNode, 
    lockNode, 
    setEditingNodeId 
  } = useStrategyFlowStore();
  
  const node = nodes.find(n => n.id === nodeId);
  const isLocked = node?.data?.locked || false;

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleDuplicate = () => {
    duplicateNode(nodeId);
    onClose();
  };

  const handleRename = () => {
    setEditingNodeId(nodeId);
    onClose();
  };

  const handleLock = () => {
    lockNode(nodeId, !isLocked);
    onClose();
  };

  const handleDelete = () => {
    deleteNode(nodeId);
    onClose();
  };

  const handleCut = () => {
    // Copy to clipboard and delete
    navigator.clipboard.writeText(JSON.stringify(node));
    deleteNode(nodeId);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(node));
    onClose();
  };

  // Position menu to stay within viewport
  const menuStyle = {
    top: y,
    left: x,
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-[#252526] border border-white/10 rounded-lg shadow-2xl overflow-hidden"
      style={menuStyle}
    >
      <div className="py-1">
        <MenuItem 
          icon={<Copy className="w-4 h-4" />} 
          label="Duplicate" 
          shortcut="Ctrl+D"
          onClick={handleDuplicate}
        />
        <MenuItem 
          icon={<Edit3 className="w-4 h-4" />} 
          label="Rename" 
          shortcut="F2"
          onClick={handleRename}
        />
        
        <div className="h-px bg-white/10 my-1" />
        
        <MenuItem 
          icon={<Scissors className="w-4 h-4" />} 
          label="Cut" 
          shortcut="Ctrl+X"
          onClick={handleCut}
        />
        <MenuItem 
          icon={<Clipboard className="w-4 h-4" />} 
          label="Copy" 
          shortcut="Ctrl+C"
          onClick={handleCopy}
        />
        
        <div className="h-px bg-white/10 my-1" />
        
        <MenuItem 
          icon={isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />} 
          label={isLocked ? "Unlock" : "Lock"}
          onClick={handleLock}
        />
        
        <div className="h-px bg-white/10 my-1" />
        
        <MenuItem 
          icon={<Trash2 className="w-4 h-4 text-red-400" />} 
          label="Delete" 
          shortcut="Del"
          onClick={handleDelete}
          danger
        />
      </div>
    </div>
  );
});

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}

const MenuItem = memo(({ icon, label, shortcut, onClick, danger }: MenuItemProps) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
        danger 
          ? 'hover:bg-red-500/20 text-red-400' 
          : 'hover:bg-white/10 text-white/80'
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {shortcut && (
        <span className="text-xs text-white/40">{shortcut}</span>
      )}
    </button>
  );
});

ContextMenu.displayName = 'ContextMenu';
MenuItem.displayName = 'MenuItem';
