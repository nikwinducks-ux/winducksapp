## Add View Password Icon to Login Page

Add a clickable eye icon to the password field that toggles between showing and hiding the password.

### Changes

**File: `src/pages/Login.tsx`**

1. Import `Eye` and `EyeOff` icons from `lucide-react`
2. Add state variable `showPassword` to track visibility
3. Wrap password input in a relative container with the toggle button positioned absolutely on the right

### Technical Details

```typescript
// New imports
import { Eye, EyeOff } from "lucide-react";

// New state
const [showPassword, setShowPassword] = useState(false);

// Password field with toggle
<div className="relative">
  <Input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
</div>
```

The toggle button uses `type="button"` to prevent form submission and is positioned absolutely within the input container for clean alignment.