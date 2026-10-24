import React, { useState } from 'react';
import { Music, Radio } from 'lucide-react';
import { UrlInputBar } from '../components/UrlInputBar';
import { MediaInspectorCard } from '../components/MediaInspectorCard';
import { JobProgressCard } from '../components/JobProgressCard';
import { inspectMediaUrl, uploadLocalMedia, createJob } from '../api';
import type { MediaMetadata, CreateJobInput, JobPublicDto } from '@mediaflow/shared';

export const AudioConverterPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [inspectedMedia, setInspectedMedia] = useState<MediaMetadata | null>(null);
  const [jobs, setJobs] = useState<JobPublicDto[]>([]);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = async (url: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const meta = await inspectMediaUrl(url);
      setInspectedMedia(meta);
    } catch (err: any) {
      setError(err.message || 'Inspection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await uploadLocalMedia(file);
      setInspectedMedia(res.metadata);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async (input: CreateJobInput) => {
    setIsStartingJob(true);
    setError(null);
    try {
      const job = await createJob({ ...input, outputType: 'audio' });
      setJobs((prev) => [job, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Failed to start audio conversion');
    } finally {
      setIsStartingJob(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-4">
          <Music className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">MP3 & Audio Converter</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Extract crystal clear audio tracks from videos or convert audio between MP3, M4A, WAV, and AAC with precise bitrates.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-6">
          {error}
        </div>
      )}

      <UrlInputBar
        onInspectUrl={handleInspect}
        onFileUpload={handleUpload}
        isLoading={isLoading}
      />

      {inspectedMedia && (
        <MediaInspectorCard
          metadata={inspectedMedia}
          onStartJob={handleStart}
          isStarting={isStartingJob}
        />
      )}

      {jobs.length > 0 && (
        <div className="mt-8 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Audio Jobs
          </h3>
          {jobs.map((job) => (
            <JobProgressCard key={job.id} initialJob={job} />
          ))}
        </div>
      )}
    </div>
  );
};
