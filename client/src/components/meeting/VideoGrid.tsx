import React from 'react';
import type { Participant, LayoutMode } from '../../types.js';
import { VideoTile } from './VideoTile.js';

interface VideoGridProps {
  selfParticipant: Participant | null;
  localStream: MediaStream | null;
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  activeSpeakerId: string | null;
  layoutMode: LayoutMode;
  pinnedId: string | null;
  onTogglePin: (id: string | null) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  selfParticipant,
  localStream,
  participants,
  remoteStreams,
  activeSpeakerId,
  layoutMode,
  pinnedId,
  onTogglePin,
}) => {
  const allTiles: { participant: Participant; stream: MediaStream | null; isLocal: boolean }[] = [];

  if (selfParticipant) {
    allTiles.push({
      participant: selfParticipant,
      stream: localStream,
      isLocal: true,
    });
  }

  participants.forEach((p) => {
    allTiles.push({
      participant: p,
      stream: remoteStreams.get(p.socketId) || null,
      isLocal: false,
    });
  });

  const totalCount = allTiles.length;

  const screenShareTile = allTiles.find((t) => t.participant.isScreenSharing);
  const effectivePinnedId = pinnedId || (screenShareTile ? (screenShareTile.isLocal ? 'self' : screenShareTile.participant.socketId) : null);

  const pinnedTile = effectivePinnedId
    ? allTiles.find((t) => (t.isLocal ? effectivePinnedId === 'self' : t.participant.socketId === effectivePinnedId))
    : null;

  if (pinnedTile && (layoutMode === 'speaker' || effectivePinnedId)) {
    const sideTiles = allTiles.filter((t) => t !== pinnedTile);

    return (
      <div className="w-full h-full p-3 sm:p-4 flex flex-col lg:flex-row gap-3 overflow-hidden">
        <div className="flex-1 h-full min-h-0">
          <VideoTile
            participant={pinnedTile.participant}
            stream={pinnedTile.stream}
            isLocal={pinnedTile.isLocal}
            isActiveSpeaker={activeSpeakerId === (pinnedTile.isLocal ? 'self' : pinnedTile.participant.socketId)}
            isPinned={true}
            onTogglePin={() => onTogglePin(null)}
          />
        </div>

        {sideTiles.length > 0 && (
          <div className="lg:w-72 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto shrink-0 max-h-48 lg:max-h-full">
            {sideTiles.map((tile) => {
              const tileId = tile.isLocal ? 'self' : tile.participant.socketId;
              return (
                <div key={tileId} className="w-48 lg:w-full h-28 lg:h-44 shrink-0">
                  <VideoTile
                    participant={tile.participant}
                    stream={tile.stream}
                    isLocal={tile.isLocal}
                    isActiveSpeaker={activeSpeakerId === tileId}
                    isPinned={false}
                    onTogglePin={() => onTogglePin(tileId)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  let gridClasses = 'grid-cols-1';
  if (totalCount === 2) {
    gridClasses = 'grid-cols-1 md:grid-cols-2';
  } else if (totalCount >= 3 && totalCount <= 4) {
    gridClasses = 'grid-cols-2';
  } else if (totalCount >= 5 && totalCount <= 6) {
    gridClasses = 'grid-cols-2 md:grid-cols-3';
  } else if (totalCount >= 7) {
    gridClasses = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  }

  return (
    <div className={`w-full h-full p-3 sm:p-4 grid ${gridClasses} gap-3 auto-rows-fr overflow-hidden`}>
      {allTiles.map((tile) => {
        const tileId = tile.isLocal ? 'self' : tile.participant.socketId;
        return (
          <div key={tileId} className="w-full h-full min-h-0">
            <VideoTile
              participant={tile.participant}
              stream={tile.stream}
              isLocal={tile.isLocal}
              isActiveSpeaker={activeSpeakerId === tileId}
              isPinned={false}
              onTogglePin={() => onTogglePin(tileId)}
            />
          </div>
        );
      })}
    </div>
  );
};
