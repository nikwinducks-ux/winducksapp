import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle } from "lucide-react";

export default function OwnerSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoted, setPromoted] = useState(false);

  const isTargetEmail = user?.email === "quack@winducks.com";
  const isAlreadyOwner = user?.role === "owner";

  if (!isTargetEmail) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" /> Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Only quack@winducks.com can run this.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAlreadyOwner || promoted) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5" /> Owner Promotion Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              quack@winducks.com is now an Owner. This action cannot be repeated.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePromote = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "promote-owner" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setPromoted(true);
      setShowConfirm(false);
      toast({ title: "Success", description: "quack@winducks.com promoted to Owner." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Owner Setup
          </CardTitle>
          <CardDescription>
            This will promote <strong>quack@winducks.com</strong> to Owner. Run once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowConfirm(true)}>
            Promote quack@winducks.com to Owner
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Owner Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Type <strong>PROMOTE</strong> below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type PROMOTE"
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <Button
              disabled={confirmText !== "PROMOTE" || loading}
              onClick={handlePromote}
            >
              {loading ? "Promoting…" : "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
