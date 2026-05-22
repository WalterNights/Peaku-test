import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { USER_ROLES, type UserRole } from '@peaku/shared';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<UserSchema>;

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      ret['id'] = ret['_id']?.toString();
      delete ret['_id'];
      delete ret['passwordHash'];
      delete ret['refreshTokenHash'];
      return ret;
    },
  },
})
export class UserSchema {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: String, required: true, enum: USER_ROLES, default: 'user' })
  role!: UserRole;

  @Prop({ type: String, required: false, trim: true })
  firstName?: string;

  @Prop({ type: String, required: false, trim: true })
  lastName?: string;

  @Prop({ type: String, default: null })
  refreshTokenHash!: string | null;
}

export const UserMongooseSchema = SchemaFactory.createForClass(UserSchema);
// El índice unique de `email` ya lo define el decorator @Prop({ unique: true }).
// Evitamos `schema.index()` explícito para no crear índices duplicados.
