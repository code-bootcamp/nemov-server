import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateProductCategoryInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  image: string;
}
