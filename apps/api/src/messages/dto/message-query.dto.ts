import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Query params arrive as strings. Unvalidated, `?limit=abc` reached Prisma as
// NaN and `?before=junk` as an Invalid Date (both 500s), and `?limit=100000`
// pulled a whole room in one request.
export class GetMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  // Pagination cursor: createdAt of the oldest message already loaded.
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;
}

export class SearchMessagesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
