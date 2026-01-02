type Role = "admin" | "user";

interface Account {
  id: string;
  email: string;
  role: Role;
}

function isAdmin(account: Account): boolean {
  return account.role === "admin";
}

