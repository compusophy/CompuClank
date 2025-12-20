"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, Rocket } from "lucide-react";
import { Deployment } from "@/lib/store";

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeployments() {
      try {
        const res = await fetch('/api/deployments');
        const data = await res.json();
        setDeployments(data.deployments || []);
      } catch (error) {
        console.error('Failed to fetch deployments:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDeployments();
  }, []);

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">My Deployments</h1>
        </div>
        <Link href="/">
          <Button>
            <Rocket className="mr-2 h-4 w-4" />
            Deploy New
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : deployments.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent>
            <p className="text-muted-foreground mb-4">You haven't deployed any tokens yet.</p>
            <Link href="/">
              <Button>Deploy Your First Token</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {deployments.map((deployment) => (
            <Card key={deployment.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{deployment.name}</CardTitle>
                    <CardDescription className="font-mono text-sm mt-1">
                      {deployment.symbol}
                    </CardDescription>
                  </div>
                  {deployment.image && (
                    <img 
                      src={deployment.image} 
                      alt={deployment.name} 
                      className="w-10 h-10 rounded-full object-cover bg-muted"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="bg-muted/50 p-2 rounded text-xs font-mono break-all">
                    {deployment.address}
                  </div>
                  
                  {deployment.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {deployment.description}
                    </p>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Deployed: {new Date(deployment.timestamp).toLocaleDateString()}
                  </div>

                  <a 
                    href={`https://clanker.world/clanker/${deployment.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center w-full mt-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors"
                  >
                    View on Clanker <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
