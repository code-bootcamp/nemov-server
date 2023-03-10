import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlBuyerAccessGuard } from 'src/commons/auth/gql-auth.guard';
import { CurrentUser } from 'src/commons/decorators/current-user.decorator';
import { Product } from '../products/entities/product.entity';
import { ProductsPicksService } from './productsPicks.service';

@Resolver()
export class ProductsPicksResolver {
  constructor(
    private readonly productsPicksService: ProductsPicksService, //
  ) {}

  @UseGuards(GqlBuyerAccessGuard)
  @Query(() => [Product])
  fetchProductsIPicked(
    @Args('page', { type: () => Int }) page: number,
    @CurrentUser() id: string,
  ): Promise<Product[]> {
    return this.productsPicksService.findAllByUser({ page, id });
  }

  @UseGuards(GqlBuyerAccessGuard)
  @Query(() => Int)
  fetchProductsIPickedCount(
    @CurrentUser() id: string, //
  ): Promise<number> {
    return this.productsPicksService.findAllCountByUser({ id });
  }

  @UseGuards(GqlBuyerAccessGuard)
  @Query(() => Boolean)
  fetchIsPicked(
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentUser() id: string,
  ): Promise<boolean> {
    return this.productsPicksService.findOneByUser({ productId, id });
  }

  @Query(() => Int)
  fetchPickCountOfProduct(
    @Args('productId', { type: () => ID }) productId: string,
  ): Promise<number> {
    return this.productsPicksService.findAllCountByProduct({ productId });
  }

  @UseGuards(GqlBuyerAccessGuard)
  @Mutation(() => Boolean)
  toggleProductPick(
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentUser() id: string,
  ): Promise<boolean> {
    return this.productsPicksService.create({ productId, id });
  }
}
