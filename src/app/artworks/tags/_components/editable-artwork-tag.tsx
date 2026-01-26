'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Edit2, Plus, X, Save } from 'lucide-react';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  creation_date: string | null;
  certificate_number: string;
};

type CustomField = {
  id: string;
  label: string;
  value: string;
};

type EditableArtworkData = {
  artist_name: string;
  title: string;
  year: string;
  description: string;
  customFields: CustomField[];
};

export function EditableArtworkTag({
  artwork,
  siteUrl,
}: {
  artwork: Artwork;
  siteUrl: string;
}) {
  const getYear = (creationDate: string | null) => {
    if (!creationDate) return '';
    try {
      const date = new Date(creationDate);
      return date.getFullYear().toString();
    } catch {
      return '';
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [tagData, setTagData] = useState<EditableArtworkData>(() => {
    const year = getYear(artwork.creation_date);
    return {
      artist_name: artwork.artist_name || '',
      title: artwork.title,
      year: year,
      description: artwork.description || '',
      customFields: [],
    };
  });

  const getCertificateUrl = (artworkId: string) => {
    return `${siteUrl}/artworks/${artworkId}/certificate`;
  };

  const handleFieldChange = (field: keyof EditableArtworkData, value: string) => {
    setTagData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCustomFieldChange = (id: string, field: 'label' | 'value', value: string) => {
    setTagData((prev) => ({
      ...prev,
      customFields: prev.customFields.map((f) =>
        f.id === id ? { ...f, [field]: value } : f
      ),
    }));
  };

  const addCustomField = () => {
    const newField: CustomField = {
      id: `custom-${Date.now()}`,
      label: '',
      value: '',
    };
    setTagData((prev) => ({
      ...prev,
      customFields: [...prev.customFields, newField],
    }));
  };

  const removeCustomField = (id: string) => {
    setTagData((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((f) => f.id !== id),
    }));
  };

  const certificateUrl = getCertificateUrl(artwork.id);

  return (
    <div
      className="border-2 border-dashed border-wine/30 p-6 print:border-wine print:p-4 print:border-solid break-inside-avoid relative"
      style={{
        pageBreakInside: 'avoid',
        minHeight: 'fit-content',
      }}
    >
      {/* Edit Toggle Button - Hidden in print */}
      {!isEditing && (
        <Button
          onClick={() => setIsEditing(true)}
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 print:hidden"
        >
          <Edit2 className="h-4 w-4 mr-1" />
          Edit
        </Button>
      )}

      {isEditing ? (
        // Edit Mode
        <div className="space-y-4 print:hidden">
          {/* Artist Name */}
          <div>
            <Label htmlFor={`artist-${artwork.id}`} className="text-sm text-ink/60 font-serif">
              Artist
            </Label>
            <Input
              id={`artist-${artwork.id}`}
              value={tagData.artist_name}
              onChange={(e) => handleFieldChange('artist_name', e.target.value)}
              className="font-display font-bold text-wine"
              placeholder="Artist name"
            />
          </div>

          {/* Title */}
          <div>
            <Label htmlFor={`title-${artwork.id}`} className="text-sm text-ink/60 font-serif">
              Title
            </Label>
            <Input
              id={`title-${artwork.id}`}
              value={tagData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="font-serif font-semibold"
              placeholder="Artwork title"
            />
          </div>

          {/* Year */}
          <div>
            <Label htmlFor={`year-${artwork.id}`} className="text-sm text-ink/60 font-serif">
              Year
            </Label>
            <Input
              id={`year-${artwork.id}`}
              value={tagData.year}
              onChange={(e) => handleFieldChange('year', e.target.value)}
              className="font-serif"
              placeholder="Year"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor={`desc-${artwork.id}`} className="text-sm text-ink/60 font-serif">
              Description
            </Label>
            <Textarea
              id={`desc-${artwork.id}`}
              value={tagData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              className="font-serif"
              placeholder="Description"
              rows={3}
            />
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-ink/60 font-serif">Custom Fields</Label>
              <Button
                type="button"
                onClick={addCustomField}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </div>
            <div className="space-y-2">
              {tagData.customFields.map((field) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        handleCustomFieldChange(field.id, 'label', e.target.value)
                      }
                      placeholder="Field label (e.g., Medium, Dimensions, Price)"
                      className="mb-2 font-serif text-sm"
                    />
                    <Input
                      value={field.value}
                      onChange={(e) =>
                        handleCustomFieldChange(field.id, 'value', e.target.value)
                      }
                      placeholder="Field value"
                      className="font-serif"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeCustomField(field.id)}
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => setIsEditing(false)}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Save className="h-4 w-4 mr-1" />
              Save & Preview
            </Button>
            <Button
              onClick={() => {
                // Reset to original values
                const year = getYear(artwork.creation_date);
                setTagData({
                  artist_name: artwork.artist_name || '',
                  title: artwork.title,
                  year: year,
                  description: artwork.description || '',
                  customFields: [],
                });
                setIsEditing(false);
              }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        // View/Print Mode
        <div>
          {/* Artist Name */}
          <div className="mb-3">
            <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Artist</p>
            <p className="text-xl font-display font-bold text-wine print:text-wine">
              {tagData.artist_name || 'Unknown Artist'}
            </p>
          </div>

          {/* Art Title */}
          <div className="mb-3">
            <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Title</p>
            <p className="text-lg font-serif font-semibold text-ink print:text-ink">
              {tagData.title}
            </p>
          </div>

          {/* Year */}
          {tagData.year && (
            <div className="mb-3">
              <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Year</p>
              <p className="text-base font-serif text-ink print:text-ink">{tagData.year}</p>
            </div>
          )}

          {/* Description */}
          {tagData.description && (
            <div className="mb-4">
              <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Description</p>
              <p className="text-sm font-serif text-ink whitespace-pre-wrap line-clamp-3 print:text-ink print:line-clamp-none">
                {tagData.description}
              </p>
            </div>
          )}

          {/* Custom Fields */}
          {tagData.customFields.map((field) => {
            if (!field.label && !field.value) return null;
            return (
              <div key={field.id} className="mb-3">
                <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">
                  {field.label || 'Custom Field'}
                </p>
                <p className="text-base font-serif text-ink print:text-ink">{field.value}</p>
              </div>
            );
          })}

          {/* QR Code */}
          <div className="mt-4 pt-4 border-t border-wine/20 print:border-wine">
            <div className="flex flex-col items-center">
              <QRCodeSVG
                value={certificateUrl}
                size={120}
                level="M"
                includeMargin={false}
              />
              <p className="text-xs text-ink/50 font-serif mt-2 text-center print:text-ink">
                Scan to view certificate
              </p>
              <p className="text-xs text-ink/40 font-serif mt-1 text-center print:text-ink">
                {artwork.certificate_number}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
