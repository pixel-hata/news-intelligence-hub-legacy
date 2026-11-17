import type { ReactNode } from 'react';
import type { Tab } from '../types';

export function TabButton(props: {
  active: Tab;
  icon: ReactNode;
  label: string;
  onClick: (tab: Tab) => void;
  tab: Tab;
}) {
  return (
    <button
      className={props.active === props.tab ? 'nav-button active' : 'nav-button'}
      onClick={() => props.onClick(props.tab)}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

export function Input(props: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid flex-1 gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      <input
        className="rounded border border-line px-3 py-2 outline-none focus:border-slate-500"
        onChange={(event) => props.onChange(event.target.value)}
        type={props.type ?? 'text'}
        value={props.value}
      />
    </label>
  );
}

export function SelectInput(props: {
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  return (
    <label className="grid flex-1 gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      <select
        className="rounded border border-line px-3 py-2 outline-none focus:border-slate-500"
        onChange={(event) => props.onChange(event.target.value)}
        value={props.value}
      >
        {props.options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MiniMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white p-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className="mt-1 font-semibold">{props.value}</p>
    </div>
  );
}
