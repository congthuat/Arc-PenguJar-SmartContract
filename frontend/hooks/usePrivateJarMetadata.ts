"use client";

import { useEffect, useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { arcTestnet } from "viem/chains";
import type { PrivateMetadata } from "@/lib/privateMetadata";
import {
  decryptPrivateMetadata,
  loadEncryptedJarMetadata,
  privateMetadataSigningMessage,
} from "@/lib/privateMetadata";
import { contractAddress } from "@/lib/config";
import type { Jar } from "@/lib/types";

export function usePrivateJarMetadata(jar: Jar) {
  const connection = useConnection();
  const signMessage = useSignMessage();
  const isPrivate = BigInt(jar.privacyMode) === 1n;
  const isOwner = Boolean(
    connection.isConnected &&
    connection.address?.toLowerCase() === jar.owner.toLowerCase(),
  );
  const [available, setAvailable] = useState(false);
  const [metadata, setMetadata] = useState<PrivateMetadata>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAvailable(Boolean(isPrivate && isOwner && contractAddress && loadEncryptedJarMetadata({
        chainId: arcTestnet.id,
        contractAddress,
        owner: jar.owner,
        jarId: jar.id.toString(),
      })));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOwner, isPrivate, jar.id, jar.owner]);

  async function decrypt() {
    if (!isPrivate || !isOwner || !connection.address || !contractAddress) return;
    setError(undefined);
    try {
      const record = loadEncryptedJarMetadata({
        chainId: arcTestnet.id,
        contractAddress,
        owner: jar.owner,
        jarId: jar.id.toString(),
      });
      if (!record) throw new Error("Private metadata unavailable on this device");
      if (record.metadataCommitment.toLowerCase() !== jar.metadataCommitment.toLowerCase()) {
        throw new Error("Stored metadata commitment does not match this jar.");
      }
      const signature = await signMessage.mutateAsync({
        account: connection.address,
        message: privateMetadataSigningMessage(connection.address, arcTestnet.id, contractAddress),
      });
      const decrypted = await decryptPrivateMetadata(record, signature);
      if (decrypted.metadata && record.metadataCommitment.toLowerCase() !== jar.metadataCommitment.toLowerCase()) {
        throw new Error("Decrypted metadata failed onchain commitment verification.");
      }
      setMetadata(decrypted.metadata);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Private metadata could not be decrypted.");
    }
  }

  return {
    isPrivate,
    isOwner,
    available,
    metadata,
    error,
    isDecrypting: signMessage.isPending,
    decrypt,
  };
}
