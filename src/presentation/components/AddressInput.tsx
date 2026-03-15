import { useEffect, useState } from "react";

interface AddressInputProps {
  address: string;
  loading: boolean;
  connected: boolean;
  onSubmit: (address: string) => void;
  bare?: boolean;
}

function formatAddress(address: string) {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function AddressInput({
  address,
  loading,
  connected,
  onSubmit,
  bare = false,
}: AddressInputProps) {
  const [value, setValue] = useState(address);
  const [expanded, setExpanded] = useState(!connected);

  useEffect(() => {
    setValue(address);
  }, [address]);

  useEffect(() => {
    setExpanded(!connected);
  }, [connected]);

  if (connected && !expanded) {
    return (
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Connected Wallet
            </div>
            <div className="text-sm text-zinc-200">{formatAddress(address)}</div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-white/8 bg-white/4 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-300 transition hover:bg-white/7"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className={bare ? "space-y-4" : "panel space-y-4 rounded-[28px] p-5"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
          Wallet Address
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0x..."
          className="w-full rounded-[20px] border border-white/8 bg-white/4 px-4 py-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[var(--gold)] focus:bg-white/6"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-[20px] bg-[var(--gold)] px-4 py-4 text-sm font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Loading..." : connected ? "Update Portfolio" : "Load Portfolio"}
      </button>
    </form>
  );
}
