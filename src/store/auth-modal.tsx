"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

interface AuthModalContextValue {
  isOpen: boolean;
  /** Open the modal. Optionally pass a callback to run after successful auth. */
  openModal: (onSuccess?: () => void) => void;
  closeModal: () => void;
  /** The callback supplied by the caller; invoked by the form on success. */
  onSuccess: (() => void) | undefined;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  isOpen: false,
  openModal: () => {},
  closeModal: () => {},
  onSuccess: undefined,
});

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // Store callback as a ref-in-state to avoid setter being called as updater fn
  const [successCallback, setSuccessCallback] = useState<
    (() => void) | undefined
  >(undefined);

  const openModal = useCallback((onSuccess?: () => void) => {
    setSuccessCallback(() => onSuccess);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSuccessCallback(undefined);
  }, []);

  const value = useMemo<AuthModalContextValue>(
    () => ({ isOpen, openModal, closeModal, onSuccess: successCallback }),
    [isOpen, openModal, closeModal, successCallback]
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  return useContext(AuthModalContext);
}
