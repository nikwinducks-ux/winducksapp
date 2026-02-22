import { createContext, useContext, useState, ReactNode } from "react";

type Role = "sp" | "admin";

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  currentSpId: string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("sp");
  const currentSpId = "sp-001"; // Mock logged-in SP

  return (
    <RoleContext.Provider value={{ role, setRole, currentSpId }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
}
