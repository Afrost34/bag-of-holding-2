/** Small parts of the map maker's header: the name field and deleting the map. */
import { Button } from '@boh/ui';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type MapDoc } from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { useAppNavigate } from '../../app/navigation';

export function NameInput({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      value={value}
      aria-label="Map name"
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onBlur={() => {
        if (value.trim() && value !== name) onRename(value.trim());
      }}
      className="min-w-0 flex-1 rounded bg-transparent px-1 font-serif text-lg font-bold focus:bg-sunken focus:outline-none"
    />
  );
}

export function DeleteMap({ doc }: { doc: MapDoc }) {
  const navigate = useAppNavigate();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <span
      role="alertdialog"
      aria-label="Delete this map?"
      className="flex items-center gap-1 text-sm"
    >
      Delete “{doc.name}”?
      <Button
        variant="primary"
        onClick={() => {
          void useMaps
            .getState()
            .remove(doc.id)
            .then(() => {
              navigate('/maps');
            });
        }}
      >
        Delete
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setConfirm(false);
        }}
      >
        Cancel
      </Button>
    </span>
  ) : (
    <Button
      variant="ghost"
      aria-label="Delete map"
      onClick={() => {
        setConfirm(true);
      }}
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}
