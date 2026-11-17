import { Check, Plus, RefreshCw } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { AuthUser } from '../types';
import { Input } from '../components/ui';

const authModeLabels = {
  confirm: 'підтвердити',
  login: 'увійти',
  register: 'реєстрація',
  resend: 'надіслати повторно',
} as const;

export function AuthScreen(props: {
  devToken: string;
  message: string;
  onConfirmed: () => void;
  onDevToken: (token: string) => void;
  onMessage: (message: string) => void;
  onToken: (token: string) => void;
  onUser: (user: AuthUser | null) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'confirm' | 'resend'>('login');

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-8 text-ink">
      <section className="w-full max-w-xl rounded border border-line bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Центр новинної аналітики</p>
        <h1 className="mt-1 text-2xl font-semibold">Доступ до акаунта</h1>
        <div className="mt-4 flex gap-2">
          {(['login', 'register', 'confirm', 'resend'] as const).map((item) => (
            <button
              className={mode === item ? 'primary-button' : 'secondary-button'}
              key={item}
              onClick={() => {
                setMode(item);
                props.onMessage('');
              }}
            >
              {authModeLabels[item]}
            </button>
          ))}
        </div>
        {props.message ? <p className="mt-3 rounded bg-slate-50 p-2 text-sm">{props.message}</p> : null}
        {mode === 'register' ? <RegisterForm {...props} /> : null}
        {mode === 'confirm' ? <ConfirmForm {...props} /> : null}
        {mode === 'resend' ? <ResendConfirmationForm {...props} /> : null}
        {mode === 'login' ? <LoginForm {...props} /> : null}
      </section>
    </main>
  );
}

function RegisterForm(props: {
  devToken: string;
  onDevToken: (token: string) => void;
  onMessage: (message: string) => void;
}) {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo-password');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await apiFetch<{ devEmailConfirmation: { token: string } }>('/auth/register', {
        body: JSON.stringify({ email, password }),
        method: 'POST',
      });
      props.onDevToken(response.devEmailConfirmation.token);
      props.onMessage(`DEV MODE: токен підтвердження ${response.devEmailConfirmation.token}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Реєстрація не вдалася';
      props.onMessage(
        message.includes('Email is already registered')
          ? 'Цей email уже зареєстрований. Увійдіть або використайте інший email.'
          : message,
      );
    }
  }

  return (
    <form className="mt-4 grid gap-3" onSubmit={submit}>
      <Input label="Email" onChange={setEmail} type="email" value={email} />
      <Input label="Пароль" onChange={setPassword} type="password" value={password} />
      <button className="primary-button" type="submit">
        <Plus size={16} />
        Зареєструватися
      </button>
      {props.devToken ? (
        <div className="rounded border border-line bg-slate-50 p-3 text-sm">
          <p className="font-semibold">DEV MODE: токен підтвердження</p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{props.devToken}</code>
          <p className="mt-2 text-xs text-slate-500">Endpoint: /api/auth/confirm-email</p>
        </div>
      ) : null}
    </form>
  );
}

function ConfirmForm(props: {
  devToken: string;
  onConfirmed: () => void;
  onMessage: (message: string) => void;
}) {
  const [token, setToken] = useState(props.devToken);

  useEffect(() => {
    setToken(props.devToken);
  }, [props.devToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch('/auth/confirm-email', {
        body: JSON.stringify({ token }),
        method: 'POST',
      });
      props.onConfirmed();
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Підтвердження email не вдалося');
    }
  }

  return (
    <form className="mt-4 grid gap-3" onSubmit={submit}>
      <Input label="DEV MODE токен" onChange={setToken} value={token} />
      <button className="primary-button" type="submit">
        <Check size={16} />
        Підтвердити
      </button>
    </form>
  );
}

function ResendConfirmationForm(props: {
  devToken: string;
  onDevToken: (token: string) => void;
  onMessage: (message: string) => void;
}) {
  const [email, setEmail] = useState('demo@example.com');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await apiFetch<{ devEmailConfirmation: { token: string } }>('/auth/resend-confirmation', {
        body: JSON.stringify({ email }),
        method: 'POST',
      });
      props.onDevToken(response.devEmailConfirmation.token);
      props.onMessage(`DEV MODE: токен підтвердження надіслано повторно ${response.devEmailConfirmation.token}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Повторне надсилання не вдалося';
      props.onMessage(
        message.includes('Email is already confirmed')
          ? 'Цей email уже підтверджено. Увійдіть.'
          : message,
      );
    }
  }

  return (
    <form className="mt-4 grid gap-3" onSubmit={submit}>
      <Input label="Email" onChange={setEmail} type="email" value={email} />
      <button className="primary-button" type="submit">
        <RefreshCw size={16} />
        Надіслати підтвердження
      </button>
      {props.devToken ? (
        <code className="break-all rounded border border-line bg-slate-50 p-2 text-xs">{props.devToken}</code>
      ) : null}
    </form>
  );
}

function LoginForm(props: {
  onMessage: (message: string) => void;
  onToken: (token: string) => void;
  onUser: (user: AuthUser | null) => void;
}) {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo-password');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', {
        body: JSON.stringify({ email, password }),
        method: 'POST',
      });
      props.onToken(response.accessToken);
      props.onUser(response.user);
      props.onMessage('');
    } catch (error) {
      props.onMessage(error instanceof Error ? error.message : 'Вхід не вдався');
    }
  }

  return (
    <form className="mt-4 grid gap-3" onSubmit={submit}>
      <Input label="Email" onChange={setEmail} type="email" value={email} />
      <Input label="Пароль" onChange={setPassword} type="password" value={password} />
      <button className="primary-button" type="submit">
        Увійти
      </button>
    </form>
  );
}
