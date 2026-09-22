import React from 'react';
import type { Participant, LayoutMode } from '../../types.js';
import { VideoTile } from './VideoTile.js';

interface VideoGridProps {
  selfParticipant: Participant | null;
  localStream: MediaStream | null;
  screenStream?: MediaStream | null;
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
  screenStream,
  participants,
  remoteStreams,
  activeSpeakerId,
  layoutMode,
  pinnedId,
  onTogglePin,
}) => {
  const allTiles: { participant: Participant; stream: MediaStream | null; isLocal: boolean; tileId: string }[] = [];

  const effectiveSelf: Participant = selfParticipant || {
    socketId: 'self',
    userId: 'self',
    displayName: 'You',
    role: 'participant',
    audioEnabled: true,
    videoEnabled: true,
    isScreenSharing: Boolean(screenStream),
    isHandRaised: false,
    joinedAt: new Date().toISOString(),
  };

  if (effectiveSelf.isScreenSharing && screenStream) {
    // 1. Dedicated presentation stage tile
    allTiles.push({
      participant: {
        ...effectiveSelf,
        displayName: `${effectiveSelf.displayName} (Presentation)`,
        isScreenSharing: true,
      },
      stream: screenStream,
      isLocal: true,
      tileId: 'self-presentation',
    });
    // 2. Presenter face camera tile
    allTiles.push({
      participant: {
        ...effectiveSelf,
        isScreenSharing: false,
      },
      stream: localStream,
      isLocal: true,
      tileId: 'self',
    });
  } else {
    allTiles.push({
      participant: effectiveSelf,
      stream: localStream,
      isLocal: true,
      tileId: 'self',
    });
  }

  participants.forEach((p) => {
    allTiles.push({
      participant: p,
      stream: remoteStreams.get(p.socketId) || null,
      isLocal: false,
      tileId: p.socketId,
    });
  });

  const totalCount = allTiles.length;

  const screenShareTile = allTiles.find((t) => t.participant.isScreenSharing);
  const effectivePinnedId = pinnedId || (screenShareTile ? screenShareTile.tileId : null);

  const pinnedTile = effectivePinnedId
    ? allTiles.find((t) => t.tileId === effectivePinnedId)
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
              const tileId = tile.tileId;
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
        const tileId = tile.tileId;
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
