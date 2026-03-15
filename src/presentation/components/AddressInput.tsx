import { useEffect, useState } from "react";

interface AddressInputProps {
  address: string;
  loading: boolean;
  connected: boolean;
  onSubmit: (address: string) => void;
  bare?: boolean;
  forceExpanded?: boolean;
}

export function AddressInput({
  address,
  loading,
  connected,
  onSubmit,
  bare = false,
  forceExpanded = false,
}: AddressInputProps) {
  const [value, setValue] = useState(address);
  const [expanded, setExpanded] = useState(!connected);

  useEffect(() => {
    setValue(address);
  }, [address]);

  useEffect(() => {
    setExpanded(!connected);
  }, [connected]);

  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
      setValue("");
    }
  }, [forceExpanded]);

  if (connected && !expanded) {
    return null;
  }

  return (
    <form
      className={bare ? "space-y-4" : "panel space-y-4 rounded-[28px] p-5"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
        setExpanded(false);
      }}
    >
      <label className="block">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0x..."
          autoFocus={forceExpanded || !connected}
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
        {loading ? "Loading..." : connected ? "Update Inspected Wallet" : "Inspect Wallet"}
      </button>
    </form>
  );
}
