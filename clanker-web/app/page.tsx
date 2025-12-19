"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  symbol: z.string().min(2, "Symbol must be at least 2 characters.").max(10, "Symbol too long"),
  description: z.string().optional(),
  image: z.string().url("Must be a valid URL (e.g. ipfs://...)").optional().or(z.literal('')),
  website: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  twitter: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  telegram: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  devBuyAmount: z.string().regex(/^\d*\.?\d*$/, "Must be a number").optional(),
  vaultPercentage: z.string().regex(/^\d+$/, "Must be a whole number").optional(),
});

export default function DeployPage() {
  const [deploying, setDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      symbol: "",
      description: "",
      image: "",
      website: "",
      twitter: "",
      telegram: "",
      devBuyAmount: "0",
      vaultPercentage: "0",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setDeploying(true);
    setDeployedAddress(null);
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      setDeployedAddress(data.address);
      toast.success("Token deployed successfully!", {
        description: `Address: ${data.address}`,
      });
    } catch (error: any) {
      toast.error("Error deploying token", {
        description: error.message,
      });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Deploy New Token</CardTitle>
          <CardDescription>Launch a token on Base using Clanker SDK</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Cool Token" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <FormControl>
                        <Input placeholder="MCT" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Tell us about your token..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL (IPFS)</FormLabel>
                    <FormControl>
                      <Input placeholder="ipfs://..." {...field} />
                    </FormControl>
                    <FormDescription>Link to your token icon</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="twitter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twitter</FormLabel>
                      <FormControl>
                        <Input placeholder="https://x.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telegram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telegram</FormLabel>
                      <FormControl>
                        <Input placeholder="https://t.me/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="devBuyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dev Buy (ETH)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.0001" {...field} />
                      </FormControl>
                      <FormDescription>Amount of ETH to buy at launch</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vaultPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vault %</FormLabel>
                      <FormControl>
                        <Input type="number" max="90" {...field} />
                      </FormControl>
                      <FormDescription>Percentage of supply to lock (0-90)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={deploying}>
                {deploying ? "Deploying..." : "Deploy Token"}
              </Button>
            </form>
          </Form>

          {deployedAddress && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
              <h3 className="font-semibold text-green-800 dark:text-green-300">Success!</h3>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Token deployed at: <span className="font-mono">{deployedAddress}</span>
              </p>
              <a 
                href={`https://clanker.world/clanker/${deployedAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline mt-2 inline-block"
              >
                View on Clanker World &rarr;
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
